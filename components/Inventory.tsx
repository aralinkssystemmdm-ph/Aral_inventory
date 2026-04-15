
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Box, 
  Search, 
  Filter, 
  ArrowUp, 
  Activity, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  ChevronRight,
  ShoppingCart,
  Info,
  X,
  Plus,
  MoreVertical,
  History,
  ArrowRightLeft,
  Settings2,
  Eye
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import AddStockModal from './AddStockModal';
import InventoryDetailsModal from './InventoryDetailsModal';
import StockTransferModal from './StockTransferModal';
import StockAdjustmentModal from './StockAdjustmentModal';

interface InventoryItem {
  item_code: string;
  item_name: string;
  total_quantity: number;
  critical_level: number;
  status: 'Available' | 'Critical';
}

interface LocationStock {
  location: string;
  quantity: number;
}

interface InventoryProps {
  onNavigate: (viewId: string, params?: any) => void;
  isDarkMode?: boolean;
}

const Inventory: React.FC<InventoryProps> = ({ onNavigate, isDarkMode = false }) => {
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Modal states
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [locationStocks, setLocationStocks] = useState<LocationStock[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  
  // New Modal States
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const fetchInventoryData = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('view_inventory_summary')
        .select('*')
        .order('item_name', { ascending: true });

      if (error) throw error;
      if (data) setInventoryData(data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventoryData(true);
    
    // Real-time subscription
    const channel = supabase
      .channel('inventory-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_location_stocks' },
        () => fetchInventoryData(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInventoryData]);

  const fetchLocationBreakdown = async (itemCode: string) => {
    setLoadingLocations(true);
    try {
      const { data, error } = await supabase
        .from('item_location_stocks')
        .select('location, quantity')
        .eq('item_code', itemCode)
        .order('quantity', { ascending: false });

      if (error) throw error;
      if (data) setLocationStocks(data);
    } catch (err) {
      console.error('Error fetching location breakdown:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleViewLocations = (item: InventoryItem) => {
    setSelectedItem(item);
    fetchLocationBreakdown(item.item_code);
    setIsLocationModalOpen(true);
  };

  const handleAction = (action: string, item: InventoryItem) => {
    setSelectedItem(item);
    setActiveActionMenu(null);
    setMenuPosition(null);
    
    switch (action) {
      case 'details':
        setIsDetailsModalOpen(true);
        break;
      case 'transfer':
        setIsTransferModalOpen(true);
        break;
      case 'add':
        setIsRestockModalOpen(true);
        break;
      case 'adjust':
        setIsAdjustModalOpen(true);
        break;
    }
  };

  const counts = useMemo(() => {
    return {
      'All Statuses': inventoryData.length,
      'Available': inventoryData.filter(item => item.status === 'Available').length,
      'Critical': inventoryData.filter(item => item.status === 'Critical').length,
    };
  }, [inventoryData]);

  const filteredData = useMemo(() => {
    return inventoryData.filter(item => {
      const matchesSearch = 
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_code.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'All Statuses' || 
        item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [inventoryData, searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    if (status === 'Critical') {
      return {
        label: 'CRITICAL',
        icon: <AlertTriangle size={12} />,
        style: 'bg-red-500/10 text-red-500 border-red-500/20'
      };
    }
    return {
      label: 'AVAILABLE',
      icon: <CheckCircle2 size={12} />,
      style: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    };
  };

  // Suggest reorder quantity (simplified logic: suggest 2x critical level if critical)
  const getReorderSuggestion = (item: InventoryItem) => {
    if (item.status === 'Critical') {
      const suggestion = (item.critical_level * 2) - item.total_quantity;
      return Math.max(suggestion, item.critical_level);
    }
    return 0;
  };

  return (
    <div className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500 relative">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={() => setIsAddStockModalOpen(true)}
            className="px-6 py-3 bg-[#FE4E02] hover:bg-[#E04502] text-white rounded-lg font-bold uppercase tracking-wider text-xs shadow-lg shadow-[#FE4E02]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Add Initial Stock
          </button>

          <div className="relative group flex-1 lg:flex-none">
            <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-[#FE4E02]' : 'text-slate-400 group-focus-within:text-[#FE4E02]'}`}>
              <Search size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Search item code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-11 pr-4 py-3 w-full lg:w-80 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FE4E02]/20 focus:border-[#FE4E02] transition-all font-medium text-sm ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
              }`}
            />
          </div>

          <div className="relative flex-1 lg:flex-none">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`w-full px-5 py-3 rounded-lg border transition-all flex items-center justify-between lg:justify-start gap-3 text-xs font-bold tracking-wider shadow-sm ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={16} className="text-[#FE4E02]" />
              {statusFilter.toUpperCase()}
              <ChevronRight className={`ml-auto transition-transform duration-300 ${isFilterOpen ? 'rotate-90' : ''}`} size={14} />
            </button>
            
            {isFilterOpen && (
              <div className={`absolute top-full left-0 mt-2 w-full sm:w-64 rounded-lg shadow-xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 border ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}>
                {['All Statuses', 'Available', 'Critical'].map((status) => {
                  const isActive = statusFilter === status;
                  return (
                    <button 
                      key={status}
                      onClick={() => { setStatusFilter(status); setIsFilterOpen(false); }}
                      className={`w-full text-left px-6 py-3 text-xs font-semibold tracking-wider transition-all flex items-center gap-3 group
                        ${isActive ? (isDarkMode ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900') : (isDarkMode ? 'text-slate-400' : 'text-slate-500') + ' hover:bg-white/5 hover:text-[#FE4E02]'}
                      `}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${status === 'Critical' ? 'bg-red-500' : status === 'Available' ? 'bg-emerald-500' : 'bg-[#FE4E02]'}`} />
                      <span className="flex-grow">{status}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black transition-all ${
                        isActive
                          ? 'bg-[#FE4E02] text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}>
                        {counts[status as keyof typeof counts]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className={`w-full rounded-lg shadow-sm border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="animate-spin text-[#FE4E02]" size={48} />
            <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Loading Inventory...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Item Code</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Item Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Total Qty</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Locations</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {filteredData.map((item, i) => {
                  const badge = getStatusBadge(item.status);
                  const isCritical = item.status === 'Critical';
                  
                  return (
                    <tr 
                      key={item.item_code} 
                      style={{ animationDelay: `${i * 50}ms` }}
                      className={`group animate-ease-in-down transition-all duration-200 border-l-4 border-transparent hover:border-[#FE4E02] hover:-translate-y-[2px] hover:shadow-lg ${
                        isCritical ? (isDarkMode ? 'bg-red-500/5' : 'bg-red-50/50') : ''
                      } ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-6 py-6 md:py-8">
                        <span className={`text-sm font-black tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.item_code}</span>
                      </td>
                      <td className="px-6 py-6 md:py-8">
                        <div className="flex items-center gap-3">
                          <Box size={16} className="text-[#FE4E02]" />
                          <span className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.item_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6 md:py-8 text-right">
                        <span className={`text-base font-bold ${isCritical ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.total_quantity}</span>
                      </td>
                      <td className="px-6 py-6 md:py-8">
                        <button 
                          onClick={() => handleViewLocations(item)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all border ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <MapPin size={12} />
                          VIEW LOCATIONS
                        </button>
                      </td>
                      <td className="px-6 py-6 md:py-8">
                        <div className="flex justify-center">
                          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full w-fit shadow-sm border transition-all duration-300 group-hover:scale-110 ${badge.style}`}>
                             {badge.icon}
                             <span className="text-[10px] font-bold tracking-widest">{badge.label}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 md:py-8 text-right relative">
                        <div className="flex items-center justify-end gap-2">
                          {isCritical && (
                            <button 
                              onClick={() => onNavigate('requests', { prefillItem: item.item_name, prefillCode: item.item_code })}
                              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#FE4E02] text-white rounded-full text-[10px] font-black tracking-widest hover:scale-105 transition-transform shadow-lg shadow-[#FE4E02]/20"
                            >
                              <ShoppingCart size={14} />
                              REQUEST
                            </button>
                          )}
                          
                          <div className="relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeActionMenu === item.item_code) {
                                  setActiveActionMenu(null);
                                  setMenuPosition(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMenuPosition({ 
                                    top: rect.bottom + window.scrollY, 
                                    left: rect.right + window.scrollX - 224 // 224 is the width of the menu (w-56)
                                  });
                                  setActiveActionMenu(item.item_code);
                                }
                              }}
                              className={`p-2 rounded-xl transition-all ${
                                activeActionMenu === item.item_code 
                                  ? 'bg-[#FE4E02] text-white' 
                                  : isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              <MoreVertical size={18} />
                            </button>

                            {activeActionMenu === item.item_code && menuPosition && createPortal(
                              <>
                                <div className="fixed inset-0 z-[90]" onClick={() => { setActiveActionMenu(null); setMenuPosition(null); }} />
                                <div 
                                  style={{ 
                                    position: 'absolute', 
                                    top: `${menuPosition.top}px`, 
                                    left: `${menuPosition.left}px` 
                                  }}
                                  className={`mt-2 w-56 rounded-2xl shadow-3xl border py-2 z-[100] animate-in fade-in slide-in-from-top-2 ${
                                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                                  }`}
                                >
                                  <button 
                                    onClick={() => handleAction('details', item)}
                                    className={`w-full text-left px-5 py-3 text-[10px] font-bold tracking-widest transition-all flex items-center gap-3 group ${
                                      isDarkMode ? 'text-slate-300 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-[#FE4E02]'
                                    }`}
                                  >
                                    <Eye size={14} className="group-hover:scale-110 transition-transform" />
                                    VIEW DETAILS
                                  </button>
                                  <button 
                                    onClick={() => handleAction('transfer', item)}
                                    className={`w-full text-left px-5 py-3 text-[10px] font-bold tracking-widest transition-all flex items-center gap-3 group ${
                                      isDarkMode ? 'text-slate-300 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-[#FE4E02]'
                                    }`}
                                  >
                                    <ArrowRightLeft size={14} className="group-hover:scale-110 transition-transform" />
                                    TRANSFER STOCK
                                  </button>
                                  <button 
                                    onClick={() => handleAction('add', item)}
                                    className={`w-full text-left px-5 py-3 text-[10px] font-bold tracking-widest transition-all flex items-center gap-3 group ${
                                      isDarkMode ? 'text-slate-300 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-[#FE4E02]'
                                    }`}
                                  >
                                    <Plus size={14} className="group-hover:scale-110 transition-transform" />
                                    ADD STOCK
                                  </button>
                                  <div className={`h-[1px] my-1 mx-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                                  <button 
                                    onClick={() => handleAction('adjust', item)}
                                    className={`w-full text-left px-5 py-3 text-[10px] font-bold tracking-widest transition-all flex items-center gap-3 group ${
                                      isDarkMode ? 'text-slate-300 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-amber-500'
                                    }`}
                                  >
                                    <Settings2 size={14} className="group-hover:scale-110 transition-transform" />
                                    ADJUST STOCK
                                  </button>
                                </div>
                              </>,
                              document.body
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredData.length === 0 && !loading && (
              <div className={`flex-grow flex flex-col items-center justify-center py-40 px-6 text-center ${isDarkMode ? 'opacity-10' : 'opacity-20'}`}>
                 <Activity size={120} strokeWidth={1} className={`mb-8 ${isDarkMode ? 'text-white' : ''}`} />
                 <p className={`text-lg font-bold uppercase tracking-[0.5em] ${isDarkMode ? 'text-white' : ''}`}>{toTitleCase('No Inventory Records Found')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Location Breakdown Modal */}
      {isLocationModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setIsLocationModalOpen(false)} />
          <div className={`relative w-full max-w-md rounded-[2rem] shadow-2xl border-2 border-[#FE4E02] p-8 animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-slate-900' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Location Breakdown</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedItem.item_name}</p>
              </div>
              <button onClick={() => setIsLocationModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {loadingLocations ? (
                <div className="flex flex-col items-center py-12 gap-3">
                  <Loader2 className="animate-spin text-[#FE4E02]" size={32} />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading Locations...</p>
                </div>
              ) : locationStocks.length > 0 ? (
                locationStocks.map((stock, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.02] ${
                      isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#FE4E02]/10 flex items-center justify-center">
                        <MapPin size={16} className="text-[#FE4E02]" />
                      </div>
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{stock.location}</span>
                    </div>
                    <span className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stock.quantity}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 opacity-40">
                  <MapPin size={48} className="mx-auto mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">No Location Data</p>
                </div>
              )}
            </div>

            {selectedItem.status === 'Critical' && (
              <div className={`mt-8 p-5 rounded-2xl border-2 border-dashed flex items-start gap-4 ${
                isDarkMode ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-100'
              }`}>
                <div className="w-10 h-10 shrink-0 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                  <Info size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Reorder Suggestion</p>
                  <p className={`text-sm font-bold leading-tight ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Stock is below critical level ({selectedItem.critical_level}). 
                    We suggest reordering <span className="text-red-500 font-black">{getReorderSuggestion(selectedItem)}</span> units.
                  </p>
                </div>
              </div>
            )}

            <button 
              onClick={() => setIsLocationModalOpen(false)}
              className="w-full mt-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Close Breakdown
            </button>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      <AddStockModal 
        isOpen={isAddStockModalOpen}
        onClose={() => setIsAddStockModalOpen(false)}
        onSuccess={() => fetchInventoryData(false)}
        isDarkMode={isDarkMode}
      />

      {/* Action Modals */}
      {selectedItem && (
        <>
          <InventoryDetailsModal 
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            item={selectedItem}
            isDarkMode={isDarkMode}
          />
          <StockTransferModal 
            isOpen={isTransferModalOpen}
            onClose={() => setIsTransferModalOpen(false)}
            onSuccess={() => fetchInventoryData(false)}
            item={selectedItem}
            isDarkMode={isDarkMode}
          />
          <StockAdjustmentModal 
            isOpen={isRestockModalOpen}
            onClose={() => setIsRestockModalOpen(false)}
            onSuccess={() => fetchInventoryData(false)}
            item={selectedItem}
            mode="add"
            isDarkMode={isDarkMode}
          />
          <StockAdjustmentModal 
            isOpen={isAdjustModalOpen}
            onClose={() => setIsAdjustModalOpen(false)}
            onSuccess={() => fetchInventoryData(false)}
            item={selectedItem}
            mode="adjust"
            isDarkMode={isDarkMode}
          />
        </>
      )}
    </div>
  );
};

export default Inventory;
