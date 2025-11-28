import { ServerResponse, UploadFormData, OnProgressCallback } from '../types';

const API_URL = 'http://localhost:3001/api/upload';

export const uploadListing = (
  formData: UploadFormData,
  onProgress: OnProgressCallback
): Promise<ServerResponse> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const data = new FormData();

    // Append credentials
    data.append('printifyKey', formData.printifyKey);
    data.append('etsyKeystring', formData.etsyKeystring);
    data.append('etsySharedSecret', formData.etsySharedSecret);

    if (formData.file) {
      data.append('zipFile', formData.file);
    } else {
      reject(new Error("No file selected"));
      return;
    }

    // 1. Upload Progress (Client -> Server)
    if (xhr.upload) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          // Scale upload to first 50% of total progress bar
          const visualPercent = Math.round(percentComplete * 0.5);
          onProgress({
            type: 'upload',
            percent: visualPercent,
            message: `Uploading data to server... ${percentComplete}%`
          });
        }
      });
    }

    // 2. Download/Processing Progress (Server -> Client Stream)
    let processedLength = 0;

    xhr.addEventListener('progress', (event) => {
      const responseText = xhr.responseText;
      const newContent = responseText.substring(processedLength);
      
      if (newContent) {
        const lines = newContent.split('\n');
        
        lines.forEach(line => {
          if (!line.trim()) return;
          try {
            const update = JSON.parse(line);
            
            if (update.type === 'progress') {
              // Scale server progress to 50-100% of total progress bar
              const visualPercent = 50 + Math.round(update.percent * 0.5);
              onProgress({
                type: 'server_progress',
                percent: visualPercent,
                message: update.message
              });
            }
          } catch (e) {
            // Ignore parse errors for partial lines in the stream
          }
        });
        
        processedLength = responseText.length;
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const lines = xhr.responseText.trim().split('\n');
          const nonEmptyLines = lines.filter(line => line.trim().length > 0);
          const lastLine = nonEmptyLines[nonEmptyLines.length - 1];
          const result = JSON.parse(lastLine);

          if (result.success !== undefined) {
             onProgress({
              type: 'complete',
              percent: 100,
              message: 'Processing Complete'
            });
            resolve(result);
          } else {
             // Fallback if structure is unexpected but valid JSON
             resolve({
                success: true,
                message: "Process finished",
                data: result.data
             });
          }
        } catch (e) {
          reject(new Error("Failed to parse server response. Ensure backend is active."));
        }
      } else {
        // Handle HTTP errors
        reject(new Error(`Server returned status ${xhr.status}: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', (e) => {
       // Real network failure
       reject(new Error("Critical Failure: Network error. Failed to connect to backend. Please ensure server is running on port 3001."));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error("Upload aborted by user"));
    });

    try {
        xhr.open('POST', API_URL);
        xhr.send(data);
    } catch (err: any) {
        reject(new Error(`Connection failed: ${err.message}`));
    }
  });
};