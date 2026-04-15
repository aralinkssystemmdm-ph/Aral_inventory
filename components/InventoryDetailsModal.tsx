
import React, { useState, useEffect } from 'react';
import { X, Box, MapPin, History, ArrowRightLeft, TrendingUp, Loader2, User, Calendar, Info } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';

interface InventoryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    item_code: string;
    item_name: string;
    total_quantity: number;
    status: string;
  };
  isDarkMode?: boolean;
}

interface Transaction {
  id: string;
  from_location: string | null;
  to_location: string;
  quantity: number;
  transaction_type: string;
  created_at: string;
  created_by: string;
  reference_id: string | null;
  reason?: string;
}

interface LocationStock {
  location: string;
  quantity: number;
}

const InventoryDetailsModal: React.FC<InventoryDetailsModalProps> = ({ isOpen, onClose, item, isDarkMode = false }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [locations, setLocations] = useState<LocationStock[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && item.item_code) {
      fetchDetails();
    }
  }, [isOpen, item.item_code]);

  const fetchDetails = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [locRes, histRes] = await Promise.all([
        supabase
          .from('item_location_stocks')
          .select('location, quantity')
          .eq('item_code', item.item_code)
          .order('quantity', { ascending: false }),
        supabase
          .from('stock_transactions')
          .select('*')
          .eq('item_code', item.item_code)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      if (locRes.data) setLocations(locRes.data);
      if (histRes.data) setHistory(histRes.data);
    } catch (err) {
      console.error('Error fetching item details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full max-w-2xl rounded-[2rem] shadow-2xl border-2 border-[#FE4E02] overflow-hidden animate-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className="p-8 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#FE4E02]/10 rounded-2xl flex items-center justify-center">
              <Box size={28} className="text-[#FE4E02]" />
            </div>
            <div>
              <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.item_name}</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.item_code}</span>
                <div className={`w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700`} />
                <span className={`text-[10px] font-black tracking-widest uppercase ${item.status === 'Critical' ? 'text-red-500' : 'text-emerald-500'}`}>
                  {item.status}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-8 flex gap-8 border-b border-slate-100 dark:border-slate-800">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
              activeTab === 'overview' ? 'text-[#FE4E02]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            Overview
            {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FE4E02] rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
              activeTab === 'history' ? 'text-[#FE4E02]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            Movement History
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FE4E02] rounded-t-full" />}
          </button>
        </div>

        {/* Content */}
        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <Loader2 className="animate-spin text-[#FE4E02]" size={40} />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading details...</p>
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Stock</p>
                  <p className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.total_quantity}</p>
                </div>
                <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Locations</p>
                  <p className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{locations.length}</p>
                </div>
              </div>

              {/* Location Breakdown */}
              <div>
                <h4 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <MapPin size={14} className="text-[#FE4E02]" />
                  Location Breakdown
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {locations.map((loc, idx) => (
                    <div 
                      key={idx}
                      className={`flex items-center justify-between p-4 rounded-2xl border ${
                        isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-50'
                      }`}
                    >
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{loc.location}</span>
                      <span className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{loc.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {history.length > 0 ? (
                history.map((tx) => (
                  <div 
                    key={tx.id}
                    className={`p-5 rounded-2xl border flex items-start gap-4 transition-all hover:scale-[1.01] ${
                      isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.transaction_type === 'Delivery' ? 'bg-emerald-500/10 text-emerald-500' :
                      tx.transaction_type === 'Transfer' ? 'bg-blue-500/10 text-blue-500' :
                      tx.transaction_type === 'Adjustment' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-[#FE4E02]/10 text-[#FE4E02]'
                    }`}>
                      {tx.transaction_type === 'Delivery' ? <TrendingUp size={20} /> :
                       tx.transaction_type === 'Transfer' ? <ArrowRightLeft size={20} /> :
                       tx.transaction_type === 'Adjustment' ? <Info size={20} /> :
                       <Box size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {tx.transaction_type}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {tx.transaction_type === 'Transfer' ? (
                          <>Moved <span className="text-[#FE4E02]">{tx.quantity}</span> from <span className="underline">{tx.from_location}</span> to <span className="underline">{tx.to_location}</span></>
                        ) : tx.transaction_type === 'Initial' ? (
                          <>Initialized <span className="text-[#FE4E02]">{tx.quantity}</span> units at <span className="underline">{tx.to_location}</span></>
                        ) : tx.transaction_type === 'Adjustment' ? (
                          <>Adjusted stock by <span className="text-[#FE4E02]">{tx.quantity}</span> at <span className="underline">{tx.to_location}</span></>
                        ) : (
                          <>Delivered <span className="text-[#FE4E02]">{tx.quantity}</span> units to <span className="underline">{tx.to_location}</span></>
                        )}
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx.created_by}</span>
                        </div>
                        {tx.reference_id && (
                          <div className="flex items-center gap-1.5">
                            <History size={12} className="text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx.reference_id}</span>
                          </div>
                        )}
                      </div>
                      {tx.reason && (
                        <p className="mt-2 text-[10px] italic text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                          Reason: {tx.reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 opacity-20">
                  <History size={64} className="mx-auto mb-4" />
                  <p className="text-sm font-black uppercase tracking-[0.3em]">No movement history</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${isDarkMode ? 'border-slate-800 bg-slate-800/30' : 'border-slate-50 bg-slate-50/30'}`}>
          <button 
            onClick={onClose}
            className="w-full py-4 bg-[#FE4E02] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[#FE4E02]/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryDetailsModal;
