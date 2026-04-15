
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Trash2, Edit3, Loader2, Package, Filter, ChevronDown, CheckSquare, Square, Plus, Download, ArrowUp, Ban, CheckCircle2, Box, Layers, Zap, Info, Eye } from 'lucide-react';
import { toTitleCase } from '../lib/utils';
import AddBundleItemModal from './AddBundleItemModal';
import AddEquipmentModal from './AddEquipmentModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface EquipmentItem {
  code: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  is_serialized: boolean;
}

interface BundleItem {
  id: string;
  code: string;
  description: string;
  bundle: string;
  program: string;
  quantity: number;
  status: 'ACTIVE' | 'INACTIVE';
}

interface EquipmentProps {
  initialTab?: 'equipment' | 'bundle';
  isDarkMode?: boolean;
}

type StatusFilter = 'All' | 'ACTIVE' | 'INACTIVE';

const Equipment: React.FC<EquipmentProps> = ({ initialTab = 'equipment', isDarkMode = false }) => {
  const { showSuccess, showError, showDelete, showInfo } = useNotification();
  const [activeTab, setActiveTab] = useState<'equipment' | 'bundle'>(initialTab);

  // Update activeTab if initialTab changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [isAddBundleModalOpen, setIsAddBundleModalOpen] = useState(false);
  const [isAddEquipmentModalOpen, setIsAddEquipmentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  
  const [showScrollTop, setShowScrollTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, [activeTab]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) setShowScrollTop(containerRef.current.scrollTop > 300);
    };
    const container = containerRef.current;
    if (container) container.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchData = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const [equipResponse, bundleResponse] = await Promise.all([
        supabase.from('equipment').select('*').is('archived_at', null).order('description', { ascending: true }),
        supabase.from('bundle_items').select('*').is('archived_at', null).order('description', { ascending: true })
      ]);
      const mapStatus = (s: string) => {
        const upper = (s || '').toUpperCase();
        return (upper === 'ACTIVE' || upper === 'ENABLE' || upper === 'AVAILABLE') ? 'ACTIVE' : 'INACTIVE';
      };
      if (equipResponse.data) setEquipmentItems(equipResponse.data.map((item: any) => ({ 
        ...item, 
        status: mapStatus(item.status),
        is_serialized: item.is_serialized || false
      })));
      if (bundleResponse.data) setBundleItems(bundleResponse.data.map((item: any) => ({ ...item, status: mapStatus(item.status) })));
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  const filteredData = useMemo(() => {
    const baseItems = activeTab === 'equipment' ? equipmentItems : bundleItems;
    return baseItems.filter((item: any) => {
      const matchesSearch = (item.code || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'All') return true;
      return item.status === statusFilter;
    });
  }, [activeTab, equipmentItems, bundleItems, searchQuery, statusFilter]);

  const handleSelectAll = () => {
    if (filteredData.length === 0) return;
    const selectableItems = filteredData.filter((item: any) => item.status === 'ACTIVE');
    
    if (selectedIds.size === selectableItems.length) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set<string>();
      selectableItems.forEach((item: any) => {
        newSelected.add(activeTab === 'equipment' ? item.code : item.id);
      });
      setSelectedIds(newSelected);
    }
  };

  const toggleItemSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleStatus = async (item: any) => {
    if (!isSupabaseConfigured) return;
    const isEquipmentTab = activeTab === 'equipment';
    const id = isEquipmentTab ? item.code : item.id;
    const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    setTogglingId(id);
    try {
      if (isEquipmentTab) {
        await supabase.from('equipment').update({ status: newStatus }).eq('code', id);
        setEquipmentItems(prev => prev.map(ei => ei.code === id ? { ...ei, status: newStatus } : ei));
      } else {
        await supabase.from('bundle_items').update({ status: newStatus }).eq('id', id);
        setBundleItems(prev => prev.map(bi => bi.id === id ? { ...bi, status: newStatus } : bi));
      }
      // If disabling, remove from current selection
      if (newStatus === 'INACTIVE') {
        const next = new Set(selectedIds);
        next.delete(id);
        setSelectedIds(next);
      }
      showInfo('Status Updated', `Item ${id} is now ${newStatus.toLowerCase()}.`);
    } catch (err: any) {
      console.error('Toggle error:', err);
      showError('Error', err.message || 'Failed to update status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!isSupabaseConfigured) return;
    const isEquipmentTab = activeTab === 'equipment';
    const table = isEquipmentTab ? 'equipment' : 'bundle_items';
    const key = isEquipmentTab ? 'code' : 'id';
    
    setIsDeleting(true);
    try {
      const userRole = localStorage.getItem('aralinks_role') || 'Admin';
      const archiveData = { 
        archived_at: new Date().toISOString(),
        archived_by: userRole
      };

      if (isBulkDeleting) {
        const ids = Array.from(selectedIds);
        const { error } = await supabase.from(table).update(archiveData).in(key, ids);
        if (error) throw error;
        showDelete('Deleted', `${ids.length} items have been archived.`);
        setSelectedIds(new Set());
      } else if (itemToDelete) {
        const id = isEquipmentTab ? itemToDelete.code : itemToDelete.id;
        const { error } = await supabase.from(table).update(archiveData).eq(key, id);
        if (error) throw error;
        showDelete('Deleted', `Item ${id} has been archived.`);
      }
      
      setIsDeleteModalOpen(false);
      await fetchData(false);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to archive item.');
    } finally {
      setIsDeleting(false);
      setIsBulkDeleting(false);
      setItemToDelete(null);
    }
  };

  const triggerBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    setItemToDelete(null);
    setIsDeleteModalOpen(true);
  };

  const downloadCatalogCSV = () => {
    let csvContent = "";
    if (activeTab === 'equipment') {
      csvContent = "CODE,Item Description,Serialized (YES/NO)\n";
    } else {
      csvContent = "Code,Description\n";
    }
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = activeTab === 'equipment' ? 'Aralinks_Global_Catalog_Template' : 'Aralinks_Bundle_Registry_Template';
    link.setAttribute("download", `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div ref={containerRef} className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500 relative" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative group flex-1 lg:flex-none">
            <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-[#FE4E02]' : 'text-slate-400 group-focus-within:text-[#FE4E02]'}`}>
              <Search size={18} />
            </div>
            <input 
              type="text" 
              placeholder={activeTab === 'equipment' ? "Search Equipment..." : "Search Bundles..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-11 pr-4 py-3 w-full lg:w-72 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FE4E02]/20 focus:border-[#FE4E02] transition-all font-medium text-sm ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' 
                  : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
              }`}
            />
          </div>

          <div className="relative flex-1 lg:flex-none" ref={filterRef}>
            <button 
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={`w-full px-5 py-3 rounded-lg border transition-all flex items-center justify-between lg:justify-start gap-3 text-xs font-bold uppercase tracking-wider shadow-sm
                ${statusFilter === 'All' ? (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500') : 
                  statusFilter === 'ACTIVE' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-red-500 border-red-500 text-white'}
              `}
            >
              <div className="flex items-center gap-3">
                <Filter size={16} className={statusFilter === 'All' ? 'text-[#FE4E02]' : 'text-white'} />
                {statusFilter}
              </div>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isFilterDropdownOpen && (
              <div className={`absolute top-full left-0 lg:right-0 mt-2 w-full sm:w-48 rounded-lg shadow-xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 border ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}>
                {(['All', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((filter) => (
                  <button 
                    key={filter}
                    onClick={() => { setStatusFilter(filter); setIsFilterDropdownOpen(false); }}
                    className={`w-full text-left px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors
                      ${statusFilter === filter ? 'text-[#FE4E02] bg-[#FE4E02]/5' : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50')}
                    `}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedIds(new Set());
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-all active:scale-95 ${
              isSelectionMode 
                ? 'bg-[#FE4E02] border-[#FE4E02] text-white shadow-lg shadow-[#FE4E02]/20' 
                : (isDarkMode 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm')
            }`}
          >
            <CheckSquare size={16} className={isSelectionMode ? 'animate-pulse' : ''} />
            <span>{isSelectionMode ? 'Cancel Selection' : 'Select'}</span>
          </button>

          {activeTab === 'equipment' && (
            <button 
              onClick={downloadCatalogCSV}
              className={`hidden lg:block p-3 md:p-3.5 border rounded-xl md:rounded-2xl shadow-xl transition-all active:scale-95 group ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
              title="Export Global Catalog Template"
            >
              <Download size={18} md:size={20} className="group-hover:translate-y-0.5 transition-transform" />
            </button>
          )}

          <button 
            onClick={activeTab === 'equipment' ? () => setIsAddEquipmentModalOpen(true) : () => setIsAddBundleModalOpen(true)}
            className={`w-full lg:w-auto px-5 md:px-7 py-3 md:py-3.5 text-white rounded-xl md:rounded-2xl font-bold text-sm md:text-base shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2
              ${activeTab === 'equipment' ? 'bg-[#FE4E02] shadow-[#FE4E02]/30 hover:bg-[#E04502]' : 'bg-[#0081f1] shadow-[#0081f1]/30 hover:bg-blue-600'}
            `}
          >
            <Plus size={18} md:size={20} />
            <span className="">{toTitleCase("Add Item")}</span>
          </button>
        </div>
      </div>

      <div className={`rounded-lg shadow-sm overflow-hidden border flex flex-col mb-10 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {loading ? (
          <div className="flex-grow flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-[#FE4E02]" size={40} />
              <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Syncing Catalog...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto min-w-[800px]">
              <thead>
                <tr className={`${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/50'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  {isSelectionMode && (
                    <th className="px-4 py-4 w-14">
                      <button 
                        onClick={handleSelectAll}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                          isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {selectedIds.size === filteredData.filter((item: any) => item.status === 'ACTIVE').length && filteredData.length > 0 ? <CheckSquare size={16} md:size={18} className="text-[#FE4E02]" /> : <Square size={16} md:size={18} className={isDarkMode ? 'text-slate-700' : 'text-white/20'} />}
                      </button>
                    </th>
                  )}
                  {activeTab === 'equipment' ? (
                    <>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Serialized</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bundle Name</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Program</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center w-48">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-50'}`}>
                {filteredData.map((item: any, i) => {
                  const id = activeTab === 'equipment' ? item.code : item.id;
                  const isSelected = selectedIds.has(id);
                  const isToggling = togglingId === id;
                  const isDisabled = item.status === 'INACTIVE';
                  
                  return (
                    <tr 
                      key={`${id}-${i}`} 
                      style={{ animationDelay: `${i * 50}ms` }}
                      className={`group animate-ease-in-down transition-all duration-200 border-l-4 border-transparent hover:border-[#0081f1] hover:-translate-y-[2px] hover:shadow-lg ${
                        isSelected ? (isDarkMode ? 'bg-[#0081f1]/10 border-l-[#0081f1]' : 'bg-[#0081f1]/5 border-l-[#0081f1]') : ''
                      } ${
                        isDisabled ? 'opacity-50 grayscale-[0.5] hover:border-transparent hover:-translate-y-0 hover:shadow-none' : ''
                      } ${
                        isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      {isSelectionMode && (
                        <td className="px-4 py-6 md:py-8">
                          <button 
                            onClick={() => toggleItemSelection(id)}
                            disabled={isDisabled}
                            className={`w-6 h-6 md:w-7 md:h-7 rounded-lg md:rounded-xl border-2 flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-[#0081f1] border-[#0081f1] text-white' 
                                : (isDarkMode ? 'border-white/10 text-white/10 hover:border-[#0081f1]' : 'border-slate-200 text-slate-200 hover:border-[#0081f1]')
                            } ${isDisabled ? 'cursor-not-allowed opacity-20' : ''}`}
                          >
                            {isSelected ? <CheckSquare size={16} md:size={18} /> : <Square size={16} md:size={18} />}
                          </button>
                        </td>
                      )}
                      {activeTab === 'equipment' ? (
                        <>
                          <td className="px-4 py-6 md:py-8">
                            <span className={`text-sm font-mono font-bold tracking-widest transition-transform inline-block origin-left ${isDisabled ? 'text-slate-400' : 'text-[#FE4E02] group-hover:scale-105'}`}>{item.code}</span>
                          </td>
                          <td className="px-4 py-6 md:py-8">
                            <span className={`text-sm font-bold tracking-tight transition-colors leading-relaxed ${isDisabled ? 'text-slate-400' : (isDarkMode ? 'text-white/80 group-hover:text-white' : 'text-slate-800 group-hover:text-slate-900')}`}>{item.description}</span>
                          </td>
                          <td className="px-4 py-6 md:py-8">
                            <button 
                              onClick={() => toggleStatus(item)}
                              disabled={isToggling || isDisabled}
                              className={`group relative flex items-center px-4 md:px-6 py-1.5 md:py-2 rounded-full text-[9px] md:text-[11px] font-bold tracking-wider border transition-all active:scale-95 shadow-sm 
                                ${item.status === 'ACTIVE' 
                                  ? (isDarkMode ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 group-hover:scale-105' : 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:scale-105') 
                                  : (isDarkMode ? 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed')}
                              `}
                            >
                              {isToggling ? <Loader2 size={12} md:size={14} className="animate-spin mr-1.5 md:mr-2" /> : <Zap size={12} md:size={14} className={`mr-1.5 md:mr-2 ${item.status === 'ACTIVE' ? 'text-emerald-500 group-hover:animate-pulse' : (isDarkMode ? 'text-white/10' : 'text-slate-300')}`} />}
                              {toTitleCase(item.status)}
                            </button>
                          </td>
                          <td className="px-4 py-6 md:py-8">
                            {item.is_serialized ? (
                              <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                YES
                              </span>
                            ) : (
                              <span className={`text-[10px] font-black tracking-widest ${isDisabled ? 'text-slate-500' : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>
                                NO
                              </span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-6 md:py-8">
                            <span className={`text-sm font-semibold tracking-tight transition-colors leading-relaxed ${isDisabled ? 'text-slate-400' : (isDarkMode ? 'text-white/80 group-hover:text-white' : 'text-slate-800 group-hover:text-slate-900')}`}>
                              {item.description}
                            </span>
                          </td>
                          <td className="px-4 py-6 md:py-8">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-widest transition-all duration-300 ${
                              isDarkMode ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {item.program}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-6 md:py-8">
                        <div className="flex items-center justify-center gap-2">
                          {activeTab === 'bundle' && (
                            <button 
                              onClick={() => {
                                console.log('Viewing bundle:', item);
                                showInfo('Viewing Bundle', `Opening details for ${item.description}`);
                              }}
                              className={`p-2 rounded-lg transition-all active:scale-95 group/btn ${
                                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                              title="View List"
                            >
                              <Eye size={18} className="group-hover/btn:scale-110 transition-transform" />
                            </button>
                          )}
                          {activeTab === 'equipment' && (
                            <button 
                              onClick={() => toggleStatus(item)}
                              disabled={isToggling}
                              className={`p-2 rounded-lg transition-all active:scale-95 group/btn ${
                                item.status === 'ACTIVE' 
                                  ? (isDarkMode ? 'text-slate-400 hover:text-red-500 hover:bg-red-500/10' : 'text-slate-500 hover:text-red-500 hover:bg-red-50') 
                                  : (isDarkMode ? 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10' : 'text-slate-500 hover:text-emerald-500 hover:bg-emerald-50')
                              }`}
                              title={item.status === 'ACTIVE' ? 'Disable Asset' : 'Enable Asset'}
                            >
                              {isToggling ? <Loader2 size={18} className="animate-spin" /> : item.status === 'ACTIVE' ? <Ban size={18} className="group-hover/btn:scale-110 transition-transform" /> : <CheckCircle2 size={18} className="group-hover/btn:scale-110 transition-transform" />}
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              if (isDisabled) return;
                              setEditingItem(item);
                              if (activeTab === 'equipment') setIsAddEquipmentModalOpen(true);
                              else setIsAddBundleModalOpen(true);
                            }}
                            disabled={isDisabled}
                            className={`p-2 rounded-lg transition-all active:scale-95 group/btn ${
                              isDisabled 
                                ? (isDarkMode ? 'text-white/5 cursor-not-allowed' : 'text-slate-200 cursor-not-allowed') 
                                : (isDarkMode ? 'text-slate-400 hover:text-[#0081f1] hover:bg-[#0081f1]/10' : 'text-slate-500 hover:text-[#0081f1] hover:bg-[#0081f1]/5')
                            }`}
                            title={isDisabled ? "Cannot edit disabled item" : "Edit"}
                          >
                            <Edit3 size={18} className={isDisabled ? '' : "group-hover/btn:scale-110 transition-transform"} />
                          </button>
                          <button 
                            onClick={() => { setItemToDelete(item); setIsBulkDeleting(false); setIsDeleteModalOpen(true); }}
                            className={`p-2 rounded-lg transition-all active:scale-95 group/btn ${
                              isDarkMode ? 'text-slate-400 hover:text-red-500 hover:bg-red-500/10' : 'text-slate-500 hover:text-red-500 hover:bg-red-50'
                            }`}
                            title="Delete"
                          >
                            <Trash2 size={18} className="group-hover/btn:scale-110 transition-transform" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredData.length === 0 && !loading && (
              <div className={`flex-grow flex flex-col items-center justify-center py-40 ${isDarkMode ? 'opacity-10' : 'opacity-20'}`}>
                 <Package size={120} strokeWidth={1} className={`mb-8 ${isDarkMode ? 'text-white' : ''}`} />
                 <p className={`text-xl font-bold tracking-[0.5em] ${isDarkMode ? 'text-white' : ''}`}>{toTitleCase("No Assets Found")}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BULK ACTIONS BAR */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className={`fixed bottom-6 sm:bottom-12 left-1/2 -translate-x-1/2 z-[80] px-6 sm:px-12 py-4 sm:py-6 rounded-2xl sm:rounded-[3rem] shadow-3xl border flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 animate-in slide-in-from-bottom-10 duration-500 w-[90%] sm:w-auto ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-[#1a1a1a] border-white/10'
        }`}>
           <div className="flex flex-col items-center text-center">
              <span className="text-[8px] sm:text-[10px] font-bold text-white/40 tracking-[0.25em]">{toTitleCase("Catalog Selection")}</span>
              <span className="text-base sm:text-lg font-bold text-white tracking-tight">{selectedIds.size} {toTitleCase("Items")}</span>
           </div>
           <div className="hidden sm:block w-[1px] h-10 bg-white/10"></div>
           <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <button 
                onClick={triggerBulkDelete}
                className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 text-[8px] sm:text-[11px] font-bold tracking-widest shadow-2xl shadow-red-500/30 transition-all active:scale-95"
              >
                <Trash2 size={14} sm:size={18} />
                {toTitleCase("Delete Records")}
              </button>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl sm:rounded-2xl text-[8px] sm:text-[11px] font-bold tracking-widest transition-all"
              >
                {toTitleCase("Dismiss")}
              </button>
           </div>
        </div>
      )}

      {showScrollTop && (
        <button
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-[60] w-12 h-12 bg-[#FE4E02] text-white rounded-full flex items-center justify-center shadow-3xl hover:bg-[#E04502] transition-all hover:scale-110 active:scale-90 animate-in fade-in zoom-in duration-300"
        >
          <ArrowUp size={20} strokeWidth={3} />
        </button>
      )}

      <AddEquipmentModal 
        isOpen={isAddEquipmentModalOpen}
        onClose={() => { setIsAddEquipmentModalOpen(false); setEditingItem(null); }}
        onSubmit={() => fetchData(false)}
        initialData={editingItem}
        isDarkMode={isDarkMode}
      />

      <AddBundleItemModal 
        isOpen={isAddBundleModalOpen}
        onClose={() => { setIsAddBundleModalOpen(false); setEditingItem(null); }}
        onSubmit={() => fetchData(false)}
        initialData={editingItem}
        isDarkMode={isDarkMode}
      />

      <DeleteConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setItemToDelete(null); setIsBulkDeleting(false); }}
        onConfirm={handleConfirmDelete}
        controlNo={itemToDelete?.code || ''}
        schoolName={itemToDelete?.description || ''}
        isDeleting={isDeleting}
        itemCount={isBulkDeleting ? selectedIds.size : undefined}
        isDarkMode={isDarkMode}
      />
    </div>
    </>
  );
};

export default Equipment;
