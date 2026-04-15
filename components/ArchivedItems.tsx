
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Trash2, RotateCcw, Loader2, Package, Box, Layers, Filter, ChevronDown, CheckSquare, Square, Info, X, Zap, AlertCircle, Archive, User, ArrowUp } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import PermanentDeleteModal from './PermanentDeleteModal';
import { useNotification } from './NotificationProvider';

interface ArchivedItemsProps {
  isDarkMode?: boolean;
}

const ArchivedItems: React.FC<ArchivedItemsProps> = ({ isDarkMode = false }) => {
  const { showSuccess, showError, showDelete } = useNotification();
  const [activeTab, setActiveTab] = useState<'equipment' | 'bundle'>('equipment');
  const [equipment, setEquipment] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const userRole = localStorage.getItem('aralinks_role') || 'Staff';
  const currentUser = localStorage.getItem('aralinks_user');
  const isAdmin = userRole.toLowerCase() === 'admin';
  const [viewMode, setViewMode] = useState<'my' | 'all'>(isAdmin ? 'all' : 'my');
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchArchived = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    
    if (showLoading) setLoading(true);
    
    try {
      let equipQuery = supabase.from('equipment').select('*').not('archived_at', 'is', null);
      let bundleQuery = supabase.from('bundle_items').select('*').not('archived_at', 'is', null);

      if (!isAdmin || viewMode === 'my') {
        equipQuery = equipQuery.eq('archived_by', currentUser);
        bundleQuery = bundleQuery.eq('archived_by', currentUser);
      }

      const [equipResponse, bundleResponse] = await Promise.all([
        equipQuery.order('archived_at', { ascending: false }),
        bundleQuery.order('archived_at', { ascending: false })
      ]);

      if (equipResponse.error) console.error('Error fetching archived equipment:', equipResponse.error);
      if (bundleResponse.error) console.error('Error fetching archived bundles:', bundleResponse.error);

      if (equipResponse.data) setEquipment(equipResponse.data);
      if (bundleResponse.data) setBundles(bundleResponse.data);
    } catch (err) {
      console.error('Failed to fetch archived items:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, viewMode, currentUser]);

  useEffect(() => {
    fetchArchived(true);
  }, [fetchArchived, viewMode]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setShowScrollTop(containerRef.current.scrollTop > 300);
      }
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const handleRestore = async (id: string, type: 'equipment' | 'bundle') => {
    if (!isSupabaseConfigured) return;
    
    setProcessingId(id);
    try {
      const table = type === 'equipment' ? 'equipment' : 'bundle_items';
      const { error } = await supabase
        .from(table)
        .update({ 
          archived_by: null, 
          archived_at: null 
        })
        .eq(type === 'equipment' ? 'code' : 'id', id);

      if (error) throw error;
      
      showSuccess('Restored', 'Item has been restored to active inventory.');
      if (type === 'equipment') {
        setEquipment(prev => prev.filter(item => item.code !== id));
      } else {
        setBundles(prev => prev.filter(item => item.id !== id));
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      showError('Error', err.message || 'Failed to restore item.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!isSupabaseConfigured || !itemToDelete) return;
    
    const id = activeTab === 'equipment' ? itemToDelete.code : itemToDelete.id;
    setProcessingId(id);
    try {
      const table = activeTab === 'equipment' ? 'equipment' : 'bundle_items';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(activeTab === 'equipment' ? 'code' : 'id', id);

      if (error) throw error;
      
      showDelete('Permanently Deleted', 'Item has been removed from the database.');
      if (activeTab === 'equipment') {
        setEquipment(prev => prev.filter(item => item.code !== id));
      } else {
        setBundles(prev => prev.filter(item => item.id !== id));
      }
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err: any) {
      console.error('Deletion error:', err);
      showError('Error', err.message || 'Failed to remove item permanently.');
    } finally {
      setProcessingId(null);
    }
  };

  const counts = useMemo(() => {
    return {
      equipment: equipment.length,
      bundle: bundles.length
    };
  }, [equipment, bundles]);

  const filteredItems = useMemo(() => {
    const items = activeTab === 'equipment' ? equipment : bundles;
    return items.filter(item => 
      searchQuery.trim() === '' || 
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.bundle && item.bundle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.program && item.program.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [equipment, bundles, activeTab, searchQuery]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('equipment')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'equipment'
                ? 'bg-white dark:bg-slate-700 text-[#FE4E02] shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Box size={14} />
            <span>Equipment</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black transition-all ${
              activeTab === 'equipment'
                ? 'bg-[#FE4E02] text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              {counts.equipment}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('bundle')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'bundle'
                ? 'bg-white dark:bg-slate-700 text-[#FE4E02] shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Layers size={14} />
            <span>Bundles</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black transition-all ${
              activeTab === 'bundle'
                ? 'bg-[#FE4E02] text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              {counts.bundle}
            </span>
          </button>
        </div>

        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder={`Search archived ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-12 pr-4 py-3.5 rounded-2xl text-sm font-bold border-2 transition-all outline-none ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 text-white focus:border-[#FE4E02]' 
                : 'bg-white border-slate-100 text-slate-800 focus:border-[#FE4E02] focus:shadow-lg focus:shadow-[#FE4E02]/10'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">View:</span>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'my' | 'all')}
            className={`h-11 px-3 rounded-2xl border-2 text-xs font-bold uppercase tracking-wider outline-none transition-all cursor-pointer ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 text-slate-300 focus:border-[#FE4E02]' 
                : 'bg-white border-slate-100 text-slate-600 focus:border-[#FE4E02]'
            }`}
          >
            <option value="my">My Records</option>
            {isAdmin && <option value="all">All Records</option>}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-grow flex flex-col items-center justify-center text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-[#FE4E02]" />
            <p className="font-bold tracking-widest uppercase text-xs">Syncing Vault...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <Archive className="text-slate-300" size={40} />
            </div>
            <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              No Archived {toTitleCase(activeTab)}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs text-sm font-medium">
              {searchQuery ? 'No items match your search criteria.' : `The ${activeTab} archive is currently empty.`}
            </p>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar" ref={containerRef}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <div 
                  key={activeTab === 'equipment' ? item.code : item.id}
                  className={`group relative p-6 rounded-[2rem] border-2 transition-all duration-300 cursor-pointer hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-2xl ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 hover:border-[#FE4E02]/30 hover:shadow-orange-500/10' 
                      : 'bg-white border-slate-50 hover:border-[#FE4E02]/20 hover:shadow-orange-500/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {activeTab === 'equipment' ? <Box size={24} /> : <Layers size={24} />}
                      </div>
                      <div>
                        <h4 className={`text-lg font-black leading-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                          {item.code}
                        </h4>
                        <p className="text-xs font-bold text-[#FE4E02] tracking-widest uppercase mt-1">
                          {activeTab === 'equipment' ? 'Equipment' : 'Bundle'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestore(activeTab === 'equipment' ? item.code : item.id, activeTab)}
                        disabled={processingId === (activeTab === 'equipment' ? item.code : item.id)}
                        className={`p-2.5 rounded-xl transition-all ${
                          isDarkMode 
                            ? 'bg-slate-800 text-slate-400 hover:text-[#FE4E02] hover:bg-[#FE4E02]/10' 
                            : 'bg-slate-50 text-slate-400 hover:text-[#FE4E02] hover:bg-[#FE4E02]/10'
                        }`}
                        title="Restore Item"
                      >
                        {processingId === (activeTab === 'equipment' ? item.code : item.id) ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <RotateCcw size={18} />
                        )}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setItemToDelete(item);
                            setIsDeleteModalOpen(true);
                          }}
                          className={`p-2.5 rounded-xl transition-all ${
                            isDarkMode 
                              ? 'bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-500/10' 
                              : 'bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-500/10'
                          }`}
                          title="Permanent Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Info size={16} className="text-slate-400 mt-0.5 shrink-0" />
                      <p className={`text-sm font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {item.description}
                      </p>
                    </div>

                    {activeTab === 'bundle' && (
                      <>
                        <div className="flex items-center gap-3">
                          <Zap size={16} className="text-slate-400 shrink-0" />
                          <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Program: <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{item.program}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Layers size={16} className="text-slate-400 shrink-0" />
                          <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Bundle: <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{item.bundle}</span>
                          </p>
                        </div>
                      </>
                    )}

                    <div className="pt-4 mt-4 border-t border-dashed border-slate-100 dark:border-slate-800 flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-slate-400" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Archived: <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{formatDate(item.archived_at)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          By: <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                            {item.archived_by === currentUser ? 'You' : (item.archived_by || 'Admin')}
                          </span>
                          {item.archived_by === currentUser && (
                            <span className="ml-2 text-[9px] text-[#FE4E02] opacity-70">(Archived by You)</span>
                          )}
                          {item.archived_by !== currentUser && isAdmin && (
                            <span className="ml-2 text-[9px] text-slate-400 opacity-70">(Archived by Admin)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <PermanentDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handlePermanentDelete}
        controlNo={itemToDelete?.code || ''}
        isDeleting={!!processingId}
        isDarkMode={isDarkMode}
        type="item"
      />

      {showScrollTop && (
        <button
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-10 right-10 z-[60] w-12 h-12 bg-[#FE4E02] text-white rounded-full flex items-center justify-center shadow-3xl hover:bg-[#E04502] transition-all hover:scale-110 active:scale-90 animate-in fade-in zoom-in duration-300"
        >
          <ArrowUp size={20} strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

export default ArchivedItems;
