
import React, { useState, useMemo } from 'react';
import { Blueprint } from '../types';
import { Search, X } from 'lucide-react';

interface CatalogViewerProps {
  catalog: Blueprint[];
  onSelect: (blueprint: Blueprint) => void;
  onClose: () => void;
}

const CatalogViewer: React.FC<CatalogViewerProps> = ({ catalog, onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return catalog;
    const s = search.toLowerCase();
    return catalog.filter(b =>
      b.title.toLowerCase().includes(s) ||
      b.brand.toLowerCase().includes(s) ||
      (b.model && b.model.toLowerCase().includes(s))
    );
  }, [catalog, search]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Printify Catalog Browser</h3>
            <p className="text-xs text-slate-500">Select a blueprint to map it to your product type</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-700"
          >
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-white">
           <div className="relative">
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
             <input
               type="text"
               placeholder="Search by brand (e.g. Bella), model (e.g. 3001), or title..."
               value={search}
               onChange={e => setSearch(e.target.value)}
               autoFocus
               className="w-full pl-10 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
             />
           </div>
           <div className="mt-2 text-xs text-slate-400 flex justify-between">
              <span>Showing {filtered.length} blueprints</span>
              {search && <span>Filtered from {catalog.length} total</span>}
           </div>
        </div>

        {/* Catalog List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/30">
           {filtered.length === 0 ? (
             <div className="text-center py-12">
                <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No blueprints found matching "{search}"</p>
                <button 
                    onClick={() => setSearch('')}
                    className="mt-2 text-primary hover:underline text-sm"
                >
                    Clear search
                </button>
             </div>
           ) : (
             filtered.map(bp => (
               <div 
                key={bp.id} 
                className="flex justify-between items-center p-3 bg-white hover:bg-indigo-50/50 border border-slate-200 rounded-lg group transition-all duration-200 cursor-pointer"
                onClick={() => onSelect(bp)}
               >
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-slate-100 rounded-md overflow-hidden shrink-0 border border-slate-200">
                        {bp.images?.[0] ? (
                            <img src={bp.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">No Img</div>
                        )}
                     </div>
                     <div>
                       <div className="font-semibold text-slate-800 group-hover:text-primary transition-colors">
                            {bp.title}
                       </div>
                       <div className="text-xs text-slate-500 flex gap-2">
                           <span className="font-medium text-slate-600">{bp.brand}</span>
                           {bp.model && <span>• Model {bp.model}</span>}
                       </div>
                     </div>
                  </div>
                  <button
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-md group-hover:bg-primary group-hover:text-white transition-all flex items-center gap-1"
                  >
                    Select <span className="opacity-70">#{bp.id}</span>
                  </button>
               </div>
             ))
           )}
        </div>
      </div>
    </div>
  );
};

export default CatalogViewer;
