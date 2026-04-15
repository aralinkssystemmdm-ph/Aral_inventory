
import React, { useState, useEffect, useRef } from 'react';
import { X, Box, MapPin, Plus, Loader2, CheckCircle2, AlertCircle, ChevronDown, Search } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import { useNotification } from './NotificationProvider';

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isDarkMode?: boolean;
}

interface EquipmentItem {
  code: string;
  description: string;
}

interface LocationItem {
  name: string;
}

const AddStockModal: React.FC<AddStockModalProps> = ({ isOpen, onClose, onSuccess, isDarkMode = false }) => {
  const { showSuccess, showError } = useNotification();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  
  const [itemSearch, setItemSearch] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  
  const itemDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target as Node)) {
        setIsItemDropdownOpen(false);
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [equipRes, locRes] = await Promise.all([
        supabase.from('equipment').select('code, description').order('description'),
        supabase.from('locations').select('name').order('name')
      ]);

      if (equipRes.data) setItems(equipRes.data);
      if (locRes.data) setLocations(locRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setSelectedLocation('');
    setQuantity('');
    setItemSearch('');
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !selectedLocation || !quantity) {
      setError('Please fill in all fields.');
      return;
    }

    const qtyNum = parseInt(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Please enter a valid quantity.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Check if stock already exists for this item/location
      const { data: existingStock, error: fetchError } = await supabase
        .from('item_location_stocks')
        .select('id, quantity')
        .eq('item_code', selectedItem.code)
        .eq('location', selectedLocation)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingStock) {
        // Requirement 4: Prevent manual editing of stock after initialization
        // We interpret this as: if it exists, we don't allow "Add Stock" to overwrite or add manually.
        // However, for "Initial Stock", we might want to allow it if it's the first time.
        // Let's assume "Add Stock" is for NEW entries only, or we can update if it's explicitly an adjustment.
        // The user said "Use manual setup only for initial stock".
        setError('Stock already exists for this item at this location. Manual updates are disabled after initialization.');
        setSubmitting(false);
        return;
      }

      // 2. Record Transaction
      const { error: txError } = await supabase
        .from('stock_transactions')
        .insert([{
          item_code: selectedItem.code,
          to_location: selectedLocation,
          quantity: qtyNum,
          transaction_type: 'Initial',
          created_by: localStorage.getItem('aralinks_user') || 'System'
        }]);

      if (txError) throw txError;

      // 3. Create initial stock record
      const { error: stockError } = await supabase
        .from('item_location_stocks')
        .insert([{
          item_code: selectedItem.code,
          item_name: selectedItem.description,
          location: selectedLocation,
          quantity: Math.max(0, qtyNum)
        }]);

      if (stockError) throw stockError;

      showSuccess('Success', 'Stock added successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adding stock:', err);
      showError('Error', err.message || 'Failed to add stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter(i => 
    i.description.toLowerCase().includes(itemSearch.toLowerCase()) ||
    i.code.toLowerCase().includes(itemSearch.toLowerCase())
  );

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
              <Plus size={24} className="text-[#FE4E02]" />
            </div>
            <div>
              <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Initial Stock Entry</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manual Setup Only</p>
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
            <h4 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Stock Added Successfully!</h4>
            <p className="text-slate-500 text-sm">The inventory has been initialized.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Item Selection */}
            <div className="space-y-2 relative" ref={itemDropdownRef}>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Item</label>
              <div 
                className={`w-full px-5 py-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                } ${isItemDropdownOpen ? 'ring-2 ring-[#FE4E02] border-transparent' : ''}`}
                onClick={() => setIsItemDropdownOpen(!isItemDropdownOpen)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Box size={18} className="text-[#FE4E02] shrink-0" />
                  <span className="font-bold truncate">{selectedItem ? selectedItem.description : 'Choose an item...'}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform ${isItemDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isItemDropdownOpen && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-3xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                  <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Search items..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs font-bold outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => { setSelectedItem(item); setIsItemDropdownOpen(false); }}
                          className={`w-full text-left px-5 py-3 text-xs font-bold transition-all hover:bg-[#FE4E02]/5 hover:text-[#FE4E02] flex flex-col gap-0.5 ${
                            selectedItem?.code === item.code ? 'bg-[#FE4E02]/10 text-[#FE4E02]' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          <span>{item.description}</span>
                          <span className="text-[9px] opacity-50 uppercase tracking-widest">{item.code}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-5 py-8 text-center opacity-40">
                        <Box size={32} className="mx-auto mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No items found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Location Selection */}
            <div className="space-y-2 relative" ref={locationDropdownRef}>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Storage Location</label>
              <div 
                className={`w-full px-5 py-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                } ${isLocationDropdownOpen ? 'ring-2 ring-[#FE4E02] border-transparent' : ''}`}
                onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MapPin size={18} className="text-[#FE4E02] shrink-0" />
                  <span className="font-bold truncate">{selectedLocation || 'Select location...'}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform ${isLocationDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isLocationDropdownOpen && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-3xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {locations.map((loc) => (
                      <button
                        key={loc.name}
                        type="button"
                        onClick={() => { setSelectedLocation(loc.name); setIsLocationDropdownOpen(false); }}
                        className={`w-full text-left px-5 py-3 text-xs font-bold transition-all hover:bg-[#FE4E02]/5 hover:text-[#FE4E02] ${
                          selectedLocation === loc.name ? 'bg-[#FE4E02]/10 text-[#FE4E02]' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
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
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Quantity</label>
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
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Initialize Stock
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddStockModal;
