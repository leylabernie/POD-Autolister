import React, { useState, ChangeEvent } from 'react';
import { UploadFormData } from '../types';
import { Key, Upload, FileArchive } from 'lucide-react';

interface UploadFormProps {
  onSubmit: (data: UploadFormData) => void;
  isProcessing: boolean;
}

const UploadForm: React.FC<UploadFormProps> = ({ onSubmit, isProcessing }) => {
  const [formData, setFormData] = useState<UploadFormData>({
    printifyKey: '',
    etsyKeystring: '',
    etsySharedSecret: '',
    file: null,
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, file: e.target.files![0] }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          Credentials
        </h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Printify API Key</label>
            <input
              type="password"
              name="printifyKey"
              value={formData.printifyKey}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              placeholder="eyJ..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Etsy Keystring</label>
            <input
              type="password"
              name="etsyKeystring"
              value={formData.etsyKeystring}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Etsy Shared Secret</label>
            <input
              type="password"
              name="etsySharedSecret"
              value={formData.etsySharedSecret}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <FileArchive className="w-5 h-5 text-primary" />
          Product Data
        </h3>
        
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative">
          <input
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            required
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center pointer-events-none">
            <Upload className="w-10 h-10 text-slate-400 mb-3" />
            <p className="text-sm text-slate-600 font-medium">
              {formData.file ? (
                <span className="text-primary">{formData.file.name}</span>
              ) : (
                "Drop ZIP file here or click to upload"
              )}
            </p>
            <div className="text-xs text-slate-500 mt-2 max-w-sm mx-auto space-y-1">
               <p>Required ZIP contents:</p>
               <ul className="list-disc list-inside text-slate-400">
                 <li><code className="text-indigo-600">original.png</code> (Design file)</li>
                 <li><code className="text-indigo-600">listing_details.txt</code> (Must include <strong>Product_Type:</strong>)</li>
                 <li><code className="text-indigo-600">mockup.*</code> (One or more images)</li>
               </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isProcessing}
          className={`
            px-6 py-3 rounded-lg font-semibold text-white shadow-lg
            transform transition-all duration-200
            ${isProcessing 
              ? 'bg-slate-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-primary to-indigo-600 hover:scale-[1.02] hover:shadow-xl'
            }
          `}
        >
          {isProcessing ? 'Processing Automation...' : 'Start Upload Process'}
        </button>
      </div>
    </form>
  );
};

export default UploadForm;