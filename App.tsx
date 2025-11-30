import React, { useState } from 'react';
import UploadForm from './components/UploadForm';
import StatusLog from './components/StatusLog';
import { UploadFormData, LogEntry, ServerResponse, ProgressEvent } from './types';
import { uploadListing } from './services/api';
import { Layers, Sparkles } from 'lucide-react';

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
      });

      if (response.success) {
        addLog('Blueprint identification successful', 'success');
        addLog(`Matched: ${response.data?.blueprintTitle} (${response.data?.blueprintBrand})`, 'success');
        addLog(`Mockup upload count: ${response.data?.mockupsUploaded}`, 'info');
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
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-yellow-500" />
                Gemini Powered Intelligence
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Blueprint Source</p>
            <p className="text-sm font-medium text-slate-700">Live Printify Catalog</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <UploadForm onSubmit={handleUpload} isProcessing={isProcessing} />
          
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
             <h4 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Gemini Intelligence
             </h4>
             <ul className="text-sm text-indigo-700 space-y-1 list-disc pl-4">
               <li>Upload a ZIP with any messy text file.</li>
               <li><strong>Gemini 2.5</strong> cleans your Title and Tags.</li>
               <li>Auto-detects product type (e.g. "Bella Canvas 3001").</li>
               <li>Matches against the <strong>Live Printify Catalog</strong>.</li>
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