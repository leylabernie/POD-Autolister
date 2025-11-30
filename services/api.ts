
import { ServerResponse, UploadFormData, OnProgressCallback } from '../types';
import JSZip from 'jszip';
import { analyzeListingWithGemini } from './gemini';

export const API_BASE_URL = 'http://localhost:3001';

export const uploadListing = async (
  formData: UploadFormData,
  onProgress: OnProgressCallback
): Promise<ServerResponse> => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!formData.file) {
        throw new Error("No file provided");
      }

      const endpoint = `${API_BASE_URL}/api/upload`;

      // 1. Client-Side Analysis (Gemini)
      onProgress({ type: 'upload', percent: 10, message: 'Reading ZIP file for AI analysis...' });

      const zip = new JSZip();
      let textContent = '';
      
      try {
        const contents = await zip.loadAsync(formData.file);
        const fileNames = Object.keys(contents.files);
        
        // Find text file for Gemini
        for (const fileName of fileNames) {
            const file = contents.files[fileName];
            if (!file.dir && fileName.toLowerCase().endsWith('.txt') && !fileName.startsWith('__MACOSX')) {
                textContent = await file.async('string');
                break;
            }
        }
      } catch (err) {
        console.warn("Failed to read ZIP client-side, proceeding without AI analysis.");
      }

      // 2. Perform Gemini Analysis if text found
      let geminiData: any = null;
      if (textContent) {
          onProgress({ type: 'upload', percent: 20, message: '✨ Gemini is analyzing listing data...' });
          geminiData = await analyzeListingWithGemini(textContent);
      }

      // 3. Prepare FormData for Local Server
      onProgress({ type: 'upload', percent: 30, message: 'Preparing secure upload...' });
      
      const payload = new FormData();
      payload.append('zipFile', formData.file);
      payload.append('printifyKey', formData.printifyKey);
      payload.append('storeId', formData.storeId);
      payload.append('etsyKeystring', formData.etsyKeystring);
      
      if (formData.blueprintMappings && formData.blueprintMappings.length > 0) {
          payload.append('blueprintMappings', JSON.stringify(formData.blueprintMappings));
      }
      
      if (geminiData) {
          console.log("Attaching Gemini Data to payload:", geminiData);
          payload.append('geminiTitle', geminiData.title);
          payload.append('geminiDescription', geminiData.description);
          payload.append('geminiTags', geminiData.tags.join(','));
          // Send the search term instead of a specific ID
          payload.append('geminiSearchTerm', geminiData.catalogSearchTerm); 
          payload.append('geminiProductType', geminiData.productType);
      }

      // 4. Send to Node.js Server via XHR
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 40) + 30; // Scale 30-70%
          onProgress({ 
            type: 'upload', 
            percent: percentComplete, 
            message: `Uploading to Server (${Math.round(event.loaded/1024)}KB)...` 
          });
        }
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 3) {
            // Processing NDJSON stream
            const responseText = xhr.responseText;
            const lines = responseText.split('\n').filter(line => line.trim() !== '');
            if (lines.length > 0) {
                try {
                    const lastLine = lines[lines.length - 1];
                    const event = JSON.parse(lastLine);
                    if (event.type === 'progress') {
                        onProgress({ 
                            type: 'server_progress', 
                            percent: Math.max(70, event.percent), // Ensure forward progress
                            message: event.message 
                        });
                    }
                } catch (e) {
                    // Ignore parsing errors for partial chunks
                }
            }
        }
        
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
               // Find the final JSON object in the stream
               const lines = xhr.responseText.split('\n').filter(line => line.trim() !== '');
               const result = JSON.parse(lines[lines.length - 1]);
               
               if (result.success) {
                   onProgress({ type: 'complete', percent: 100, message: 'Upload Complete!' });
                   resolve({
                        success: true,
                        message: result.message,
                        data: result.data
                   });
               } else {
                   throw new Error(result.message || 'Server returned failure');
               }
            } catch (e: any) {
               reject(new Error(`Failed to parse server response: ${e.message}`));
            }
          } else {
            reject(new Error(`Server Error ${xhr.status}: ${xhr.statusText || 'Connection Refused'}. Is the local server running (node server/server.js)?`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error(`Network Error: Failed to connect to ${endpoint}. Is the server running?`));
      };

      xhr.send(payload);

    } catch (error: any) {
      console.error("Upload Logic Error:", error);
      reject(error);
    }
  });
};
