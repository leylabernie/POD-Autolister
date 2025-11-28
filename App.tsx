import React, { useState } from 'react';
import UploadForm from './components/UploadForm';
import StatusLog from './components/StatusLog';
import { UploadFormData, LogEntry, ServerResponse, PRINTIFY_BLUEPRINTS, ProgressEvent } from './types';
import { uploadListing } from './services/api';
import { Layers } from 'lucide-react';

const App: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<ServerResponse | null>(null);
  
  // Progress State
  const [progress, setProgress] = useState({
    percent: 0,
    message: 'Initializing...',
    isActive: false
  });

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  };

  const handleUpload = async (formData: UploadFormData) => {
    setIsProcessing(true);
    setLogs([]); // Clear previous logs
    setResult(null);
    setProgress({ percent: 0, message: 'Starting...', isActive: true });

    addLog('Starting upload process...', 'info');

    try {
      const response = await uploadListing(formData, (event: ProgressEvent) => {
          // Update visual progress bar
          setProgress(prev => ({
              ...prev,
              percent: event.percent,
              message: event.message
          }));

          // Log major milestones
          if (event.type === 'server_progress' && event.percent % 10 === 0) {
              // Only log occasional updates to avoid flooding
              // addLog(event.message, 'info'); 
          }
      });

      if (response.success) {
        addLog('Blueprint identification successful', 'success');
        addLog(`Mapped to Blueprint ID: ${response.data?.blueprintId}`, 'info');
        addLog(`Etsy Mockup upload count: ${response.data?.mockupsUploaded}`, 'info');
        addLog('Process finished successfully.', 'success');
        setResult(response);
      } else {
        addLog(`Server Error: ${response.message}`, 'error');
        setResult(response);
      }

    } catch (error: any) {
      addLog(`Critical Failure: ${error.message}`, 'error');
      setResult({
        success: false,
        message: `Critical Failure: ${error.message || "Unknown error occurred"}`
      });
    } finally {
      setIsProcessing(false);
      setProgress(prev => ({ ...prev, isActive: false }));
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Layers className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">POD Automator</h1>
              <p className="text-xs text-slate-500">Intelligent Blueprint Matching</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Supported Blueprints</p>
            <p className="text-sm font-medium text-slate-700">{PRINTIFY_BLUEPRINTS.length} Configured</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <UploadForm onSubmit={handleUpload} isProcessing={isProcessing} />
          
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
             <h4 className="text-sm font-semibold text-indigo-800 mb-2">How it works</h4>
             <ul className="text-sm text-indigo-700 space-y-1 list-disc pl-4">
               <li>Upload a ZIP containing <code className="bg-white px-1 rounded">listing_details.txt</code></li>
               <li>System parses <strong>Product_Type</strong> header</li>
               <li>Automatically selects correct Printify Blueprint</li>
               <li>Creates products on Printify & Etsy draft</li>
             </ul>
          </div>
        </div>

        <div className="lg:col-span-2">
          <StatusLog logs={logs} result={result} progress={progress} />
        </div>
      </main>
    </div>
  );
};

export default App;