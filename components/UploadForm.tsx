
import React, { useState, ChangeEvent } from 'react';
import { UploadFormData, BlueprintMapping, Blueprint } from '../types';
import { Key, Upload, FileArchive, ShoppingBag, Settings2, Plus, Trash2, BookOpen } from 'lucide-react';
import CatalogViewer from './CatalogViewer';
import { API_BASE_URL } from '../services/api';

interface UploadFormProps {
  onSubmit: (data: UploadFormData) => void;
  isProcessing: boolean;
}

const UploadForm: React.FC<UploadFormProps> = ({ onSubmit, isProcessing }) => {
  const [formData, setFormData] = useState<UploadFormData>({
    printifyKey: '',
    storeId: '',
    etsyKeystring: '',
    etsySharedSecret: '',
    file: null,
    blueprintMappings: []
  });

  const [newMapping, setNewMapping] = useState<BlueprintMapping>({ keyword: '', blueprintId: 0 });
  const [catalog, setCatalog] = useState<Blueprint[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, file: e.target.files![0] }));
    }
  };

  const handleAddMapping = () => {
    if (newMapping.keyword && newMapping.blueprintId) {
      setFormData(prev => ({
        ...prev,
        blueprintMappings: [...prev.blueprintMappings, newMapping]
      }));
      setNewMapping({ keyword: '', blueprintId: 0 });
    }
  };

  const handleRemoveMapping = (index: number) => {
    setFormData(prev => ({
      ...prev,
      blueprintMappings: prev.blueprintMappings.filter((_, i) => i !== index)
    }));
  };

  const fetchCatalog = async () => {
    if (!formData.printifyKey) return alert("Please enter Printify API Key first");
    
    setLoadingCatalog(true);
    try {
      // Check if we already have it to avoid refetching
      if (catalog.length > 0) {
          setShowCatalog(true);
          setLoadingCatalog(false);
          return;
      }

      const res = await fetch(`${API_BASE_URL}/api/catalog`, {
        headers: { 'Authorization': `Bearer ${formData.printifyKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
        setShowCatalog(true);
      } else {
        const errText = await res.text();
        alert(`Failed to fetch catalog: ${errText}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error fetching catalog: ${e.message}. Ensure backend server is running.`);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleCatalogSelect = (bp: Blueprint) => {
      setNewMapping(prev => ({ ...prev, blueprintId: bp.id }));
      setShowCatalog(false);
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
          Configuration
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Printify API Key</label>
            <input
              type="password"
              name="printifyKey"
              value={formData.printifyKey}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              placeholder="Paste your Printify Access Token here"
            />
          </div>

          <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Printify Store ID</label>
              <div className="relative">
                  <ShoppingBag className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                  type="text"
                  name="storeId"
                  value={formData.storeId}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="e.g. 24702235"
                  />
              </div>
          </div>
        </div>
      </div>

      {/* Blueprint Overrides Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Blueprint Overrides
            </h3>
            <button 
                type="button" 
                onClick={fetchCatalog}
                className="text-xs sm:text-sm px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-2 text-indigo-700 font-medium transition-colors disabled:opacity-50"
                disabled={loadingCatalog}
            >
                {loadingCatalog ? 'Loading...' : <><BookOpen className="w-4 h-4"/> Open Catalog Browser</>}
            </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
            Map specific product types (e.g. "Hoodie") to exact Blueprint IDs to override auto-detection.
        </p>

        <div className="flex gap-2 mb-4">
            <input
                type="text"
                placeholder="Product Type (e.g. Hoodie)"
                value={newMapping.keyword}
                onChange={e => setNewMapping({...newMapping, keyword: e.target.value})}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            
            <div className="relative w-32">
                <input
                    type="number"
                    placeholder="ID"
                    value={newMapping.blueprintId || ''}
                    onChange={e => setNewMapping({...newMapping, blueprintId: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
            </div>

            <button 
                type="button"
                onClick={handleAddMapping}
                className="bg-indigo-100 text-indigo-700 p-2 rounded-lg hover:bg-indigo-200"
            >
                <Plus className="w-5 h-5" />
            </button>
        </div>

        {formData.blueprintMappings.length > 0 && (
            <div className="space-y-2">
                {formData.blueprintMappings.map((m, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded border border-slate-200 text-sm">
                        <div>
                            <span className="font-semibold text-slate-700">{m.keyword}</span>
                            <span className="mx-2 text-slate-400">→</span>
                            <span className="font-mono text-slate-500">ID: {m.blueprintId}</span>
                        </div>
                        <button type="button" onClick={() => handleRemoveMapping(idx)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        )}
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
               <p>Supported ZIP contents:</p>
               <ul className="list-disc list-inside text-slate-400">
                 <li><code className="text-indigo-600">Any Image</code> (design)</li>
                 <li><code className="text-indigo-600">listing.txt</code> or any txt (details)</li>
                 <li><code className="text-indigo-600">Mockups</code> (auto-detected)</li>
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
          {isProcessing ? 'Processing...' : 'Start Upload'}
        </button>
      </div>

      {showCatalog && (
        <CatalogViewer 
            catalog={catalog} 
            onClose={() => setShowCatalog(false)} 
            onSelect={handleCatalogSelect} 
        />
      )}
    </form>
  );
};

export default UploadForm;
