
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronDown, Plus, Trash2, Check, Loader2, Search, Package, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface AddBundleItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any;
  isDarkMode?: boolean;
}

interface EquipmentRecord {
  description: string;
  code: string;
  is_serialized?: boolean;
}

interface SelectedItem extends EquipmentRecord {
  quantity: string;
  is_serialized: boolean;
}

const DEFAULT_BUNDLES = [
  'AF TOOLS',
  'ARDUINO',
  'LITTLE BITS',
  'MAKEY-MAKEY',
  'MICRO:BIT',
  'RASPBERRY'
];

const AddBundleItemModal: React.FC<AddBundleItemModalProps> = ({ isOpen, onClose, onSubmit, initialData, isDarkMode = false }) => {
  const { showSuccess, showError } = useNotification();
  const [formData, setFormData] = useState({ 
    bundle: 'AF TOOLS', 
    program: '', 
    status: 'ACTIVE' 
  });
  
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Equipment selection states
  const [equipmentList, setEquipmentList] = useState<EquipmentRecord[]>([]);
  const [isLoadingEquip, setIsLoadingEquip] = useState(false);
  const [equipSearchQuery, setEquipSearchQuery] = useState('');

  // Bundle management states
  const [bundleList, setBundleList] = useState<string[]>(DEFAULT_BUNDLES);
  const [isAddingBundle, setIsAddingBundle] = useState(false);
  const [newBundleName, setNewBundleName] = useState('');
  const [isSavingBundle, setIsSavingBundle] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const programDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Delete bundle confirmation state
  const [bundleToDelete, setBundleToDelete] = useState<string | null>(null);
  const [isDeletingBundle, setIsDeletingBundle] = useState(false);

  const fetchExistingBundles = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('bundles')
        .select('name')
        .order('name', { ascending: true });
      
      if (data && data.length > 0) {
        setBundleList(data.map(b => b.name));
      } else {
        setBundleList(DEFAULT_BUNDLES);
      }
    } catch (err) {
      console.error('Error fetching bundles:', err);
    }
  };

  useEffect(() => {
    const fetchEquipment = async () => {
      setIsLoadingEquip(true);
      try {
        const { data, error } = await supabase
          .from('equipment')
          .select('description, code, is_serialized')
          .or('status.eq.Active,status.eq.Enable,status.eq.Available')
          .order('description', { ascending: true });
        
        if (error) throw error;
        if (data) {
          setEquipmentList(data);
        }
      } catch (err) {
        console.error('Error fetching equipment for bundle:', err);
      } finally {
        setIsLoadingEquip(false);
      }
    };

    if (isOpen) {
      fetchEquipment();
      fetchExistingBundles();
      setEquipSearchQuery('');
      setValidationError(null);
      
      if (initialData) {
        setFormData({
          bundle: initialData.bundle,
          program: initialData.program || '',
          status: initialData.status || 'ACTIVE'
        });
        setSelectedItems([{ 
          description: initialData.description, 
          code: initialData.code || '',
          quantity: initialData.quantity?.toString() || '1',
          is_serialized: initialData.is_serialized || false
        }]);
      } else {
        setFormData({ bundle: 'AF TOOLS', program: '', status: 'ACTIVE' });
        setSelectedItems([]);
      }
    }
  }, [isOpen, initialData]);

  const filteredEquipment = useMemo(() => {
    if (!equipSearchQuery) return equipmentList;
    return equipmentList.filter(e => 
      e.description.toLowerCase().includes(equipSearchQuery.toLowerCase()) ||
      e.code.toLowerCase().includes(equipSearchQuery.toLowerCase())
    );
  }, [equipmentList, equipSearchQuery]);

  const toggleItemSelection = (item: EquipmentRecord) => {
    setSelectedItems(prev => {
      const isSelected = prev.some(i => i.code === item.code);
      if (isSelected) {
        return prev.filter(i => i.code !== item.code);
      } else {
        return [...prev, { 
          ...item, 
          quantity: '1',
          is_serialized: item.is_serialized || false
        }];
      }
    });
    setValidationError(null);
  };

  const updateItemSerialization = (code: string, isSerializable: boolean) => {
    setSelectedItems(prev => prev.map(item => 
      item.code === code ? { ...item, is_serialized: isSerializable } : item
    ));
  };

  const updateItemQuantity = (code: string, quantity: string) => {
    const numericValue = quantity.replace(/[^0-9]/g, '');
    setSelectedItems(prev => prev.map(item => 
      item.code === code ? { ...item, quantity: numericValue } : item
    ));
    setValidationError(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (programDropdownRef.current && !programDropdownRef.current.contains(event.target as Node)) {
        setIsProgramDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isValid = useMemo(() => {
    const hasProgram = formData.program.trim() !== '';
    const hasItems = selectedItems.length > 0;
    const allQuantitiesValid = selectedItems.every(item => item.quantity && parseInt(item.quantity) > 0);
    return hasProgram && hasItems && allQuantitiesValid;
  }, [formData.program, selectedItems]);

  if (!isOpen) return null;

  const handleAddNewBundle = async () => {
    const trimmed = newBundleName.trim().toUpperCase();
    if (!trimmed) {
      setIsAddingBundle(false);
      return;
    }

    setIsSavingBundle(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('bundles')
          .insert([{ name: trimmed }]);
        
        if (error && !error.message.includes('unique constraint')) {
          console.error('Error saving new bundle:', error);
          showError('Error', 'Failed to save bundle: ' + error.message);
        }
      }

      setBundleList(prev => {
        if (!prev.includes(trimmed)) {
          return [...prev, trimmed].sort();
        }
        return prev;
      });
      
      setFormData({ ...formData, bundle: trimmed });
      setNewBundleName('');
      setIsAddingBundle(false);
      setIsDropdownOpen(false);
    } catch (err) {
      console.error('Failed to add bundle:', err);
    } finally {
      setIsSavingBundle(false);
    }
  };

  const handleDeleteBundle = (e: React.MouseEvent, bundleName: string) => {
    e.stopPropagation();
    setBundleToDelete(bundleName);
  };

  const confirmDeleteBundle = async () => {
    if (!bundleToDelete || !isSupabaseConfigured) return;
    
    setIsDeletingBundle(true);
    const bundleName = bundleToDelete;
    const originalList = [...bundleList];
    setBundleList(prev => prev.filter(b => b !== bundleName));
    if (formData.bundle === bundleName) setFormData({...formData, bundle: 'AF TOOLS'});

    try {
      const { error } = await supabase
        .from('bundles')
        .delete()
        .eq('name', bundleName);
      
      if (error) {
        setBundleList(originalList);
        showError('Error', 'Could not delete bundle: ' + error.message);
      } else {
        showSuccess('Deleted', `Bundle "${bundleName}" removed from list.`);
      }
    } catch (err) {
      setBundleList(originalList);
      console.error('Delete bundle error:', err);
    } finally {
      setIsDeletingBundle(false);
      setBundleToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.program) {
      setValidationError('Please select a Program.');
      return;
    }
    
    if (selectedItems.length === 0) {
      setValidationError('Please select at least one item from the catalog.');
      return;
    }

    const invalidQty = selectedItems.find(item => !item.quantity || parseInt(item.quantity) <= 0);
    if (invalidQty) {
      setValidationError(`Please enter a valid quantity for "${invalidQty.description}".`);
      return;
    }

    const invalidSerial = selectedItems.find(item => item.is_serialized && !item.serial_number?.trim());
    if (invalidSerial) {
      setValidationError(`Serial Number is required for "${invalidSerial.description}".`);
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);
    
    try {
      if (initialData && initialData.id) {
        // Edit mode: Standard update by ID
        const item = selectedItems[0];
        const { error } = await supabase
          .from('bundle_items')
          .update({
            code: item.code,
            description: item.description,
            bundle: formData.bundle,
            program: formData.program,
            quantity: parseInt(item.quantity) || 0,
            status: formData.status,
            is_serialized: item.is_serialized
          })
          .eq('id', initialData.id);
        if (error) throw error;
      } else {
        // Add mode: Prevent duplicates by attaching to existing record if it exists for this bundle/program/code combo
        
        // 1. Fetch current items for this specific bundle/program to check for existing codes
        const { data: existingItems } = await supabase
          .from('bundle_items')
          .select('id, code')
          .eq('bundle', formData.bundle)
          .eq('program', formData.program);
        
        // 2. Map existing records by their code to easily retrieve IDs
        const existingMap = new Map<string, string>();
        existingItems?.forEach(item => existingMap.set(item.code, item.id));

        // 3. Prepare payload. If code exists in map, include the ID to perform an update
        const payload = selectedItems.map(item => ({
          ...(existingMap.has(item.code) ? { id: existingMap.get(item.code) } : {}),
          code: item.code,
          description: item.description,
          bundle: formData.bundle,
          program: formData.program,
          quantity: parseInt(item.quantity) || 0,
          status: formData.status,
            is_serialized: item.is_serialized
        }));
        
        // 4. Upsert ensures that existing codes in this bundle are UPDATED rather than DUPLICATED
        const { error } = await supabase.from('bundle_items').upsert(payload);
        if (error) throw error;
      }

      onSubmit(formData);
      showSuccess('Success', initialData ? 'Bundle item updated successfully' : `${selectedItems.length} items added to bundle`);
      onClose();
    } catch (err: any) {
      console.error('Bundle Item Error:', err);
      showError('Error', err.message || 'Failed to save bundle items.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full max-w-[560px] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-full sm:h-auto flex flex-col ${
        isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
      }`}>
        <div className={`px-6 sm:px-10 pt-6 sm:pt-10 pb-4 sm:pb-6 flex items-center justify-between border-b shrink-0 ${
          isDarkMode ? 'border-slate-800' : 'border-slate-50'
        }`}>
          <h2 className={`text-xl sm:text-2xl font-black font-poppins tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-[#323232]'}`}>
            {initialData ? 'Edit Bundle Item' : `Add Items to ${formData.bundle} Bundle`}
          </h2>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${
            isDarkMode ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'
          }`}>
            <X size={20} sm:size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-6 space-y-6 overflow-y-auto custom-scrollbar flex-grow">
          {validationError && (
            <div className={`border p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 ${
              isDarkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'
            }`}>
              <AlertCircle size={18} className="text-red-500 shrink-0" />
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{validationError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest px-1">
                Bundle Name <span className="text-[#FE4E02]">*</span>
              </label>
              <div className="relative" ref={dropdownRef}>
                {isAddingBundle ? (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="NEW BUNDLE..."
                      value={newBundleName}
                      onChange={(e) => setNewBundleName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNewBundle())}
                      className={`flex-grow px-4 py-3 border-2 rounded-xl text-sm outline-none transition-all font-black uppercase tracking-wider ${
                        isDarkMode 
                          ? 'bg-slate-950 border-[#FE4E02]/30 text-slate-100 focus:border-[#FE4E02]' 
                          : 'bg-white border-[#FE4E02]/30 text-slate-800 focus:border-[#FE4E02]'
                      }`}
                    />
                    <button 
                      type="button"
                      onClick={handleAddNewBundle}
                      disabled={isSavingBundle}
                      className="p-3 bg-[#FE4E02] text-white rounded-xl shadow-lg hover:bg-[#E04502] active:scale-95 transition-all flex items-center justify-center min-w-[44px]"
                    >
                      {isSavingBundle ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setIsAddingBundle(false); setNewBundleName(''); }}
                      className={`p-3 rounded-xl transition-all ${
                        isDarkMode ? 'bg-slate-800 text-slate-500 hover:bg-slate-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={`w-full px-4 py-3 border rounded-xl text-sm text-left focus:outline-none transition-all shadow-sm font-black text-[#FE4E02] uppercase tracking-wider flex items-center justify-between ${
                        isDarkMode 
                          ? (isDropdownOpen ? 'border-[#FE4E02] ring-4 ring-[#FE4E02]/10 bg-slate-950' : 'border-slate-800 bg-slate-950') 
                          : (isDropdownOpen ? 'border-[#FE4E02] ring-4 ring-[#FE4E02]/5 bg-white' : 'border-slate-200 bg-white')
                      }`}
                    >
                      <span className="truncate">{formData.bundle}</span>
                      <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180 text-[#FE4E02]' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                      <div className={`absolute z-[130] left-0 right-0 mt-2 border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
                        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                        <div className="max-h-[200px] overflow-y-auto py-2">
                          {bundleList.map((bundle) => (
                            <div
                              key={bundle}
                              onClick={() => { setFormData({...formData, bundle}); setIsDropdownOpen(false); setValidationError(null); }}
                              className={`px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors group flex items-center justify-between ${
                                formData.bundle === bundle 
                                  ? (isDarkMode ? 'bg-blue-500/10 text-[#FE4E02]' : 'bg-[#FE4E02]/5 text-[#FE4E02]') 
                                  : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-50')
                              }`}
                            >
                              <span className="uppercase tracking-widest">{bundle}</span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteBundle(e, bundle)}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                                title="Delete from list"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className={`border-t ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/50'}`}>
                          <button
                            type="button"
                            onClick={() => { setIsAddingBundle(true); setIsDropdownOpen(false); }}
                            className={`w-full px-4 py-3 text-left text-[#FE4E02] font-black text-[10px] flex items-center gap-2 transition-colors uppercase tracking-[0.2em] ${
                              isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-white'
                            }`}
                          >
                            <Plus size={16} /> Create New Bundle
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest px-1">
                Program <span className="text-[#FE4E02]">*</span>
              </label>
              <div className="relative" ref={programDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsProgramDropdownOpen(!isProgramDropdownOpen)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm text-left focus:outline-none transition-all shadow-sm font-black uppercase tracking-wider flex items-center justify-between ${
                    !formData.program 
                      ? (isDarkMode ? 'border-amber-500/30 bg-amber-500/5 text-slate-500' : 'border-amber-200 bg-amber-50/30 text-slate-400') 
                      : (isDarkMode 
                          ? (isProgramDropdownOpen ? 'border-[#0081f1] ring-4 ring-[#0081f1]/10 bg-slate-950 text-slate-100' : 'border-slate-800 bg-slate-950 text-slate-100') 
                          : (isProgramDropdownOpen ? 'border-[#0081f1] ring-4 ring-[#0081f1]/5 bg-white text-slate-800' : 'border-slate-200 bg-white text-slate-800'))
                  }`}
                >
                  <span className="truncate">{formData.program || '-- SELECT PROGRAM --'}</span>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isProgramDropdownOpen ? 'rotate-180 text-[#0081f1]' : ''}`} />
                </button>

                {isProgramDropdownOpen && (
                  <div className={`absolute z-[130] left-0 right-0 mt-2 border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className="max-h-[200px] overflow-y-auto py-2">
                      {['ACE', 'HUB', 'NGS', 'TEACH'].map((program) => (
                        <button
                          key={program}
                          type="button"
                          onClick={() => {
                            setFormData({...formData, program});
                            setIsProgramDropdownOpen(false);
                            setValidationError(null);
                          }}
                          className={`w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                            formData.program === program 
                              ? (isDarkMode ? 'bg-[#0081f1]/10 text-[#0081f1]' : 'bg-[#0081f1]/5 text-[#0081f1]') 
                              : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-50')
                          }`}
                        >
                          {program}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="block text-[11px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest">
                Select Items ({selectedItems.length}) <span className="text-[#FE4E02]">*</span>
              </label>
              {selectedItems.length > 0 && (
                <button 
                  type="button" 
                  onClick={() => setSelectedItems([])}
                  className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>
            
            <div className="relative group">
              <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${
                isDarkMode ? 'text-slate-600 group-focus-within:text-[#0081f1]' : 'text-slate-300 group-focus-within:text-[#0081f1]'
              }`}>
                <Search size={16} />
              </div>
              <input 
                type="text" 
                placeholder="Search equipment database..."
                value={equipSearchQuery}
                onChange={(e) => setEquipSearchQuery(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 border rounded-2xl text-sm focus:ring-4 outline-none transition-all font-medium ${
                  isDarkMode 
                    ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:bg-slate-950 focus:border-[#0081f1] focus:ring-[#0081f1]/10' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-300 focus:bg-white focus:border-[#0081f1] focus:ring-[#0081f1]/5'
                }`}
              />
            </div>

            <div className={`border-2 rounded-[1.5rem] overflow-hidden transition-colors ${
              selectedItems.length === 0 
                ? (isDarkMode ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-100 bg-slate-50/30') 
                : (isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50/30')
            }`}>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                {isLoadingEquip ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Synchronizing...</span>
                  </div>
                ) : filteredEquipment.length > 0 ? (
                  filteredEquipment.map((item) => {
                    const selectedItem = selectedItems.find(i => i.code === item.code);
                    const isSelected = !!selectedItem;
                    return (
                      <div 
                        key={item.code}
                        className={`
                          flex items-center gap-4 px-4 py-3 rounded-xl transition-all mb-1 last:mb-0 group
                          ${isSelected 
                            ? (isDarkMode ? 'bg-slate-900 shadow-md border-l-4 border-[#0081f1]' : 'bg-white shadow-md border-l-4 border-[#0081f1]') 
                            : (isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-white/60')}
                        `}
                      >
                        <div 
                          onClick={() => toggleItemSelection(item)}
                          className={`shrink-0 cursor-pointer transition-colors ${isSelected ? 'text-[#0081f1]' : 'text-slate-300'}`}
                        >
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>
                        <div 
                          onClick={() => toggleItemSelection(item)}
                          className="flex-grow min-w-0 cursor-pointer"
                        >
                          <p className={`text-[13px] font-bold truncate ${
                            isSelected ? 'text-[#0081f1]' : (isDarkMode ? 'text-slate-300' : 'text-slate-700')
                          }`}>
                            {item.description}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{item.code}</p>
                        </div>

                        {isSelected && (
                          <div className="shrink-0 flex flex-col gap-2 animate-in zoom-in-95 min-w-[120px]">
                            <div className="flex items-center justify-end gap-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Qty:</label>
                              <input 
                                type="text"
                                inputMode="numeric"
                                value={selectedItem.quantity}
                                onChange={(e) => updateItemQuantity(item.code, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-12 px-2 py-1 border rounded-lg text-xs font-black text-center outline-none transition-all
                                  ${(!selectedItem.quantity || parseInt(selectedItem.quantity) <= 0) 
                                    ? (isDarkMode ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-red-50 text-red-500 bg-red-50') 
                                    : (isDarkMode ? 'bg-slate-950 border-slate-800 text-[#FE4E02] focus:border-[#FE4E02]' : 'bg-white border-slate-200 text-[#FE4E02] focus:border-[#FE4E02]')}
                                `}
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Serializable:</label>
                              <div className="relative">
                                <select
                                  value={selectedItem.is_serialized ? 'YES' : 'NO'}
                                  onChange={(e) => updateItemSerialization(item.code, e.target.value === 'YES')}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`pl-2 pr-6 py-1 border rounded-lg text-[10px] font-black outline-none transition-all appearance-none cursor-pointer ${
                                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300 focus:border-[#FE4E02]' : 'bg-white border-slate-200 text-slate-600 focus:border-[#FE4E02]'
                                  }`}
                                >
                                  <option value="NO">NO</option>
                                  <option value="YES">YES</option>
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 opacity-50">
                    <Package size={32} strokeWidth={1.5} className="mb-2" />
                    <p className="text-[11px] font-black uppercase tracking-widest">No matching items</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest px-1">Status</label>
              <div className="relative" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm text-left focus:outline-none transition-all shadow-sm font-black uppercase tracking-wider flex items-center justify-between ${
                    isDarkMode 
                      ? (isStatusDropdownOpen ? 'border-[#0081f1] ring-4 ring-[#0081f1]/10 bg-slate-950 text-slate-100' : 'border-slate-800 bg-slate-950 text-slate-100') 
                      : (isStatusDropdownOpen ? 'border-[#0081f1] ring-4 ring-[#0081f1]/5 bg-white text-slate-800' : 'border-slate-200 bg-white text-slate-800')
                  }`}
                >
                  <span className="truncate">{formData.status}</span>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isStatusDropdownOpen ? 'rotate-180 text-[#0081f1]' : ''}`} />
                </button>

                {isStatusDropdownOpen && (
                  <div className={`absolute z-[130] left-0 right-0 mt-2 border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className="max-h-[200px] overflow-y-auto py-2">
                      {['ACTIVE', 'INACTIVE'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            setFormData({...formData, status});
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                            formData.status === status 
                              ? (isDarkMode ? 'bg-[#0081f1]/10 text-[#0081f1]' : 'bg-[#0081f1]/5 text-[#0081f1]') 
                              : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-50')
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={`pt-6 flex items-center justify-end gap-3 border-t sticky bottom-0 shrink-0 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50'
          }`}>
            <button 
              type="button" 
              onClick={onClose} 
              className={`px-4 sm:px-8 py-3 font-black uppercase tracking-[0.15em] transition-all text-[10px] sm:text-[11px] ${
                isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || isLoadingEquip || !isValid} 
              className={`px-6 sm:px-12 py-3 sm:py-3.5 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2 sm:gap-3
                ${isValid ? 'bg-[#FE4E02] hover:bg-[#E04502] shadow-[#FE4E02]/20' : (isDarkMode ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-300 cursor-not-allowed')}
                disabled:opacity-50 disabled:pointer-events-none
              `}
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={16} sm:size={18} /> : (initialData ? <Check size={16} sm:size={18} /> : <Plus size={16} sm:size={18} />)}
              {isSubmitting ? 'Saving...' : (initialData ? 'Update Item' : `Add ${selectedItems.length} Items`)}
            </button>
          </div>
        </form>
      </div>

      <DeleteConfirmationModal
        isOpen={!!bundleToDelete}
        onClose={() => setBundleToDelete(null)}
        onConfirm={confirmDeleteBundle}
        controlNo={bundleToDelete || ''}
        isDeleting={isDeletingBundle}
        isDarkMode={isDarkMode}
        type="bundle"
      />
    </div>
  );
};

export default AddBundleItemModal;
