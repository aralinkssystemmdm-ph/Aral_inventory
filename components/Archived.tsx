
import React, { useState, useEffect } from 'react';
import { Archive, FileText, Package, LayoutGrid, Box, Layers } from 'lucide-react';
import ArchivedRequestsList from './ArchivedRequestsList';
import ArchivedItems from './ArchivedItems';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ArchivedModuleProps {
  isDarkMode?: boolean;
}

const ArchivedModule: React.FC<ArchivedModuleProps> = ({ isDarkMode = false }) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'items'>('requests');
  const [counts, setCounts] = useState({ requests: 0, items: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      if (!isSupabaseConfigured) return;

      try {
        const [reqRes, equipRes, bundleRes] = await Promise.all([
          supabase.from('item_requests').select('*', { count: 'exact', head: true }).not('archived_at', 'is', null),
          supabase.from('equipment').select('*', { count: 'exact', head: true }).not('archived_at', 'is', null),
          supabase.from('bundle_items').select('*', { count: 'exact', head: true }).not('archived_at', 'is', null)
        ]);

        setCounts({
          requests: reqRes.count || 0,
          items: (equipRes.count || 0) + (bundleRes.count || 0)
        });
      } catch (err) {
        console.error('Error fetching archived counts:', err);
      }
    };

    fetchCounts();

    // Subscribe to changes to keep counts updated
    const reqChannel = supabase.channel('archived-req-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_requests' }, fetchCounts)
      .subscribe();
    
    const equipChannel = supabase.channel('archived-equip-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, fetchCounts)
      .subscribe();

    const bundleChannel = supabase.channel('archived-bundle-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bundle_items' }, fetchCounts)
      .subscribe();

    return () => {
      supabase.removeChannel(reqChannel);
      supabase.removeChannel(equipChannel);
      supabase.removeChannel(bundleChannel);
    };
  }, []);

  return (
    <div className={`flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      {/* Header Section */}
      <div className="mb-4">
        <div className="flex items-center gap-4 mb-1">
          <div className="w-10 h-10 rounded-lg bg-[#FE4E02]/10 flex items-center justify-center text-[#FE4E02]">
            <Archive size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">The Vault</h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold tracking-wider uppercase text-xs">
              Archived Records & Assets
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-[1.5rem] w-fit mb-4 shadow-inner">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-3 px-8 py-3 rounded-[1.2rem] text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap active:scale-95 ${
            activeTab === 'requests'
              ? 'bg-[#FE4E02] text-white shadow-lg shadow-orange-500/20'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText size={18} />
          <span>Requests</span>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
            activeTab === 'requests'
              ? 'bg-white text-[#FE4E02]'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}>
            {counts.requests}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-3 px-8 py-3 rounded-[1.2rem] text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap active:scale-95 ${
            activeTab === 'items'
              ? 'bg-[#FE4E02] text-white shadow-lg shadow-orange-500/20'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Package size={18} />
          <span>Items</span>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
            activeTab === 'items'
              ? 'bg-white text-[#FE4E02]'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}>
            {counts.items}
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-grow min-h-0">
        {activeTab === 'requests' ? (
          <ArchivedRequestsList isDarkMode={isDarkMode} />
        ) : (
          <ArchivedItems isDarkMode={isDarkMode} />
        )}
      </div>
    </div>
  );
};

export default ArchivedModule;
