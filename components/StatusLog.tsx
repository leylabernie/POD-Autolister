import React from 'react';
import { LogEntry, ServerResponse } from '../types';
import { CheckCircle2, AlertCircle, Terminal, Loader2, Tag } from 'lucide-react';

interface StatusLogProps {
  logs: LogEntry[];
  result: ServerResponse | null;
  progress: {
    percent: number;
    message: string;
    isActive: boolean;
  };
}

const StatusLog: React.FC<StatusLogProps> = ({ logs, result, progress }) => {
  const showLogs = logs.length > 0 || result || progress.isActive;

  if (!showLogs) return null;

  return (
    <div className="space-y-6">
      
      {/* Progress Bar Section */}
      {progress.isActive && !result && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-end mb-2">
             <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
               <Loader2 className="w-4 h-4 animate-spin text-primary" />
               {progress.message}
             </span>
             <span className="text-sm font-bold text-primary">{progress.percent}%</span>
           </div>
           <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
             <div 
               className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out" 
               style={{ width: `${progress.percent}%` }}
             ></div>
           </div>
           <p className="text-xs text-slate-400 mt-2 text-right">
             {progress.percent < 50 ? 'Phase 1: Secure Upload' : 'Phase 2: Intelligent Automation'}
           </p>
        </div>
      )}

      {/* Logs Console */}
      <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800">
        <div className="bg-slate-800 px-4 py-2 flex items-center gap-2 border-b border-slate-700">
          <Terminal className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-mono text-slate-400">System Logs</span>
        </div>
        <div className="p-4 h-64 overflow-y-auto font-mono text-sm space-y-2">
          {logs.map((log, index) => (
            <div key={index} className="flex gap-3">
              <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
              <span className={`
                ${log.type === 'error' ? 'text-red-400' : ''}
                ${log.type === 'success' ? 'text-green-400' : ''}
                ${log.type === 'warning' ? 'text-yellow-400' : ''}
                ${log.type === 'info' ? 'text-blue-300' : ''}
              `}>
                {log.message}
              </span>
            </div>
          ))}
          {progress.isActive && (
             <div className="flex gap-3 animate-pulse">
                <span className="text-slate-500 shrink-0">...</span>
                <span className="text-slate-400">_</span>
             </div>
          )}
        </div>
      </div>

      {/* Result Card */}
      {result && (
        <div className={`p-6 rounded-xl border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-4">
            {result.success ? (
              <CheckCircle2 className="w-6 h-6 text-green-600 mt-1" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 mt-1" />
            )}
            <div className="w-full">
              <h4 className={`text-lg font-bold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.success ? 'Automation Complete' : 'Process Failed'}
              </h4>
              <p className={`mt-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.message}
              </p>
              
              {result.data && (
                <div className="mt-4 space-y-3">
                   {/* Data Overview */}
                   <div className="bg-white/60 rounded-lg p-4 text-sm grid grid-cols-2 gap-4">
                      <div className="col-span-2 border-b border-black/5 pb-2 mb-2">
                        <span className="block text-xs uppercase tracking-wider text-slate-500">Listing Title</span>
                        <span className="font-semibold text-slate-800">{result.data.listingTitle}</span>
                      </div>
                      
                      <div>
                        <span className="block text-xs uppercase tracking-wider text-slate-500">Input Type</span>
                        <span className="font-semibold text-slate-800">{result.data.productType}</span>
                      </div>
                      <div>
                        <span className="block text-xs uppercase tracking-wider text-slate-500">Mockups</span>
                        <span className="font-semibold text-slate-800">{result.data.mockupsUploaded} files</span>
                      </div>
                   </div>

                   {/* Blueprint Details Section */}
                   {result.data.blueprintId && (
                     <div className="bg-indigo-100/50 border border-indigo-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                           <Tag className="w-4 h-4 text-indigo-600" />
                           <h5 className="font-semibold text-indigo-900 text-sm">Matched Printify Blueprint</h5>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                           <div>
                              <span className="block text-[10px] uppercase font-bold text-indigo-400">Category</span>
                              <span className="font-medium text-indigo-800">{result.data.blueprintTitle}</span>
                           </div>
                           <div>
                              <span className="block text-[10px] uppercase font-bold text-indigo-400">Brand</span>
                              <span className="font-medium text-indigo-800">{result.data.blueprintBrand}</span>
                           </div>
                           <div>
                              <span className="block text-[10px] uppercase font-bold text-indigo-400">Blueprint ID</span>
                              <span className="font-mono font-medium text-indigo-800">#{result.data.blueprintId}</span>
                           </div>
                        </div>
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusLog;