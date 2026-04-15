
import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRightLeft, MapPin, Loader2, CheckCircle2, AlertCircle, ChevronDown, Search } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import { useNotification } from './NotificationProvider';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: {
    item_code: string;
    item_name: string;
    total_quantity: number;
  };
  isDarkMode?: boolean;
}

interface LocationStock {
  location: string;
  quantity: number;
}

interface LocationItem {
  name: string;
}

const StockTransferModal: React.FC<StockTransferModalProps> = ({ isOpen, onClose, onSuccess, item, isDarkMode = false }) => {
  const { showSuccess, showError } = useNotification();
  const [locations, setLocations] = useState<LocationStock[]>([]);
  const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fromLocation, setFromLocation] = useState<string>('');
  const [toLocation, setToLocation] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  
  const [isFromDropdownOpen, setIsFromDropdownOpen] = useState(false);
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  
  const fromDropdownRef = useRef<HTMLDivElement>(null);
  const toDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && item.item_code) {
      fetchData();
      resetForm();
    }
  }, [isOpen, item.item_code]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fromDropdownRef.current && !fromDropdownRef.current.contains(event.target as Node)) {
        setIsFromDropdownOpen(false);
      }
      if (toDropdownRef.current && !toDropdownRef.current.contains(event.target as Node)) {
        setIsToDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [locRes, allLocRes] = await Promise.all([
        supabase
          .from('item_location_stocks')
          .select('location, quantity')
          .eq('item_code', item.item_code)
          .gt('quantity', 0)
          .order('quantity', { ascending: false }),
        supabase
          .from('locations')
          .select('name')
          .order('name')
      ]);

      if (locRes.data) setLocations(locRes.data);
      if (allLocRes.data) setAllLocations(allLocRes.data);
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFromLocation('');
    setToLocation('');
    setQuantity('');
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromLocation || !toLocation || !quantity) {
      setError('Please fill in all fields.');
      return;
    }

    if (fromLocation === toLocation) {
      setError('Source and destination locations must be different.');
      return;
    }

    const qtyNum = parseInt(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Please enter a valid quantity.');
      return;
    }

    const sourceStock = locations.find(l => l.location === fromLocation);
    if (!sourceStock || sourceStock.quantity < qtyNum) {
      setError(`Insufficient stock at ${fromLocation}. Available: ${sourceStock?.quantity || 0}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const currentUser = localStorage.getItem('aralinks_user') || 'System';

      // 1. Record Transaction
      const { error: txError } = await supabase
        .from('stock_transactions')
        .insert([{
          item_code: item.item_code,
          from_location: fromLocation,
          to_location: toLocation,
          quantity: qtyNum,
          transaction_type: 'Transfer',
          created_by: currentUser
        }]);

      if (txError) throw txError;

      // 2. Subtract from Source (Skip if it's a Warehouse)
      const isWarehouse = fromLocation.toLowerCase().includes('warehouse');
      if (!isWarehouse) {
        const { error: subError } = await supabase
          .from('item_location_stocks')
          .update({ quantity: Math.max(0, sourceStock.quantity - qtyNum) })
          .eq('item_code', item.item_code)
          .eq('location', fromLocation);

        if (subError) throw subError;
      }

      // 3. Add to Destination
      const { data: destStock } = await supabase
        .from('item_location_stocks')
        .select('id, quantity')
        .eq('item_code', item.item_code)
        .eq('location', toLocation)
        .maybeSingle();

      if (destStock) {
        const { error: addError } = await supabase
          .from('item_location_stocks')
          .update({ quantity: Math.max(0, destStock.quantity + qtyNum) })
          .eq('id', destStock.id);
        if (addError) throw addError;
      } else {
        const { error: addError } = await supabase
          .from('item_location_stocks')
          .insert([{
            item_code: item.item_code,
            item_name: item.item_name,
            location: toLocation,
            quantity: Math.max(0, qtyNum)
          }]);
        if (addError) throw addError;
      }

      setSuccess(true);
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error transferring stock:', err);
      setError(err.message || 'Failed to transfer stock.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-[2rem] shadow-2xl border-2 border-[#FE4E02] p-8 animate-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900' : 'bg-white'
      }`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#FE4E02]/10 rounded-2xl flex items-center justify-center">
              <ArrowRightLeft size={24} className="text-[#FE4E02]" />
            </div>
            <div>
              <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Transfer Stock</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.item_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={48} className="text-emerald-500" />
            </div>
            <h4 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Transfer Successful!</h4>
            <p className="text-slate-500 text-sm">Stock has been moved between locations.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* From Location */}
            <div className="space-y-2 relative" ref={fromDropdownRef}>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Location (Source)</label>
              <div 
                className={`w-full px-5 py-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                } ${isFromDropdownOpen ? 'ring-2 ring-[#FE4E02] border-transparent' : ''}`}
                onClick={() => setIsFromDropdownOpen(!isFromDropdownOpen)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MapPin size={18} className="text-[#FE4E02] shrink-0" />
                  <span className="font-bold truncate">{fromLocation || 'Select source location...'}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform ${isFromDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isFromDropdownOpen && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-3xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {locations.length > 0 ? (
                      locations.map((loc) => (
                        <button
                          key={loc.location}
                          type="button"
                          onClick={() => { setFromLocation(loc.location); setIsFromDropdownOpen(false); }}
                          className={`w-full text-left px-5 py-3 text-xs font-bold transition-all hover:bg-[#FE4E02]/5 hover:text-[#FE4E02] flex items-center justify-between ${
                            fromLocation === loc.location ? 'bg-[#FE4E02]/10 text-[#FE4E02]' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          <span>{loc.location}</span>
                          <span className="text-[10px] opacity-50">{loc.quantity} available</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-5 py-8 text-center opacity-40">
                        <MapPin size={32} className="mx-auto mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No stock available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* To Location */}
            <div className="space-y-2 relative" ref={toDropdownRef}>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Location (Destination)</label>
              <div 
                className={`w-full px-5 py-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                } ${isToDropdownOpen ? 'ring-2 ring-[#FE4E02] border-transparent' : ''}`}
                onClick={() => setIsToDropdownOpen(!isToDropdownOpen)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MapPin size={18} className="text-[#FE4E02] shrink-0" />
                  <span className="font-bold truncate">{toLocation || 'Select destination location...'}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform ${isToDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isToDropdownOpen && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-3xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {allLocations.map((loc) => (
                      <button
                        key={loc.name}
                        type="button"
                        onClick={() => { setToLocation(loc.name); setIsToDropdownOpen(false); }}
                        className={`w-full text-left px-5 py-3 text-xs font-bold transition-all hover:bg-[#FE4E02]/5 hover:text-[#FE4E02] ${
                          toLocation === loc.name ? 'bg-[#FE4E02]/10 text-[#FE4E02]' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transfer Quantity</label>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                  className={`w-full px-5 py-4 rounded-2xl border outline-none font-bold text-lg transition-all ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-[#FE4E02]' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-[#FE4E02]'
                  }`}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-500">
                <AlertCircle size={18} className="shrink-0" />
                <p className="text-xs font-bold tracking-tight">{error}</p>
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={onClose}
                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                  isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={submitting}
                className="flex-[2] py-4 bg-[#FE4E02] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[#FE4E02]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRightLeft size={18} />}
                Confirm Transfer
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default StockTransferModal;
