
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronDown, CheckCircle2, FileText, Check, Plus, Trash2, Paperclip, Upload, AlertCircle, Sparkles, Box, Loader2, Calendar, MapPin, Notebook, Zap, ShieldCheck, Tag } from 'lucide-react';
import { toTitleCase } from '../lib/utils';
import { RequestData } from './ItemsRequest';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface RequestedItem {
  id: string | number;
  qty: string;
  uom: string;
  item: string;
  code: string;
  is_serialized?: boolean;
}

interface EquipmentRecord {
  code: string;
  description: string;
  is_serialized: boolean;
}

interface SchoolItem {
  name: string;
  is_buffer: boolean;
}

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  initialData?: RequestData;
  isDarkMode?: boolean;
  prefillItem?: string;
  prefillCode?: string;
}

const NewRequestModal: React.FC<NewRequestModalProps> = ({ isOpen, onClose, onSubmit, initialData, isDarkMode = false, prefillItem, prefillCode }) => {
  const { showSuccess, showError, showWarning } = useNotification();
  const [requestedBy, setRequestedBy] = useState('');
  const [requestedByError, setRequestedByError] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [controlNo, setControlNo] = useState('');
  const [location, setLocation] = useState('');
  const [requestType, setRequestType] = useState<'ARALINKS' | 'SMS-PROTRACK'>('ARALINKS');
  const [dateOfRequest, setDateOfRequest] = useState('');
  const [program, setProgram] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('Select a School');
  const [requestedItems, setRequestedItems] = useState<RequestedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  
  const [pendingBundle, setPendingBundle] = useState<string | null>(null);
  const [bundleQuantity, setBundleQuantity] = useState('1');

  const [equipmentList, setEquipmentList] = useState<EquipmentRecord[]>([]);
  const [isLoadingEquip, setIsLoadingEquip] = useState(false);

  const [availableBundles, setAvailableBundles] = useState<string[]>([]);
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);
  const [selectedBundleDropdown, setSelectedBundleDropdown] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBundleDropdownOpen, setIsBundleDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isAddingNewLocation, setIsAddingNewLocation] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  const [openItemDropdownId, setOpenItemDropdownId] = useState<string | null>(null);
  const [openUomDropdownId, setOpenUomDropdownId] = useState<string | null>(null);
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bundleDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const programDropdownRef = useRef<HTMLDivElement>(null);
  const itemDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const uomDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const getTodayIso = () => {
    return new Date().toISOString().split('T')[0];
  };

  const formatToDisplay = (isoDate: string) => {
    if (!isoDate) return '';
    if (isoDate.includes('/')) return isoDate;
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const [y, m, d] = parts;
    return `${m}/${d}/${y}`;
  };

  const formatToIso = (displayDate: string) => {
    if (!displayDate) return '';
    if (displayDate.includes('-')) return displayDate;
    const parts = displayDate.split('/');
    if (parts.length !== 3) return displayDate; 
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  const fetchEquipment = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setIsLoadingEquip(true);
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('code, description, is_serialized')
        .or('status.eq.Active,status.eq.Enable,status.eq.Available')
        .order('description', { ascending: true });
      
      if (data) setEquipmentList(data as EquipmentRecord[]);
    } catch (err) {
      console.error('Error fetching equipment for dropdown:', err);
    } finally {
      setIsLoadingEquip(false);
    }
  }, []);

  const fetchSchools = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSchools([
        { name: 'Another Academy', is_buffer: false },
        { name: 'BHNHS', is_buffer: true },
        { name: 'NHS-Main', is_buffer: false }
      ]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('name, is_buffer')
        .order('name', { ascending: true });
      
      if (error) {
        console.warn('Schools table error:', error.message);
        return;
      }
      
      if (data && Array.isArray(data)) {
        setSchools(data as SchoolItem[]);
      }
    } catch (err) {
      console.error('Failed to fetch schools:', err);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLocations([
        { id: '1', name: 'Areys Warehouse' },
        { id: '2', name: 'IT Basement' },
        { id: '3', name: 'Project 6 warehouse' },
        { id: '4', name: 'Silang Warehouse' }
      ]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) setLocations(data);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  }, []);

  const handleQuickAddLocation = async () => {
    if (!newLocationInput.trim() || !isSupabaseConfigured) return;
    
    const name = newLocationInput.trim();
    try {
      const { error } = await supabase
        .from('locations')
        .insert([{ name }]);

      if (error) throw error;
      
      setLocation(name);
      setNewLocationInput('');
      setIsAddingNewLocation(false);
      setIsLocationDropdownOpen(false);
    } catch (err) {
      console.error('Error quick adding location:', err);
    }
  };

  useEffect(() => {
    fetchLocations();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('locations-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => {
          fetchLocations();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchLocations]);

  useEffect(() => {
    const fetchBundlesForProgram = async () => {
      if (!program || !isSupabaseConfigured) {
        setAvailableBundles([]);
        return;
      }

      setIsLoadingBundles(true);
      try {
        const { data, error } = await supabase
          .from('bundle_items')
          .select('bundle')
          .eq('program', program);
        
        if (data) {
          const uniqueBundles = Array.from(new Set((data as any[]).map(item => String(item.bundle || ''))));
          setAvailableBundles(uniqueBundles.sort());
        }
      } catch (err) {
        console.error('Error fetching bundles:', err);
      } finally {
        setIsLoadingBundles(false);
      }
    };

    fetchBundlesForProgram();
  }, [program]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (bundleDropdownRef.current && !bundleDropdownRef.current.contains(event.target as Node)) {
        setIsBundleDropdownOpen(false);
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
      if (programDropdownRef.current && !programDropdownRef.current.contains(event.target as Node)) {
        setIsProgramDropdownOpen(false);
      }
      if (openItemDropdownId && itemDropdownRefs.current[openItemDropdownId] && !itemDropdownRefs.current[openItemDropdownId]?.contains(event.target as Node)) {
        setOpenItemDropdownId(null);
      }
      if (openUomDropdownId && uomDropdownRefs.current[openUomDropdownId] && !uomDropdownRefs.current[openUomDropdownId]?.contains(event.target as Node)) {
        setOpenUomDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setRequestedByError(false);
      setHasAttemptedSubmit(false);
      setPendingBundle(null);
      setBundleQuantity('1');
      setSelectedBundleDropdown('');
      fetchSchools();
      fetchEquipment();
      setIsDropdownOpen(false);
      setSelectedFile(null);
      
      if (initialData) {
        setRequestedBy(initialData.requestedBy || '');
        setTicketNumber(initialData.ticketNo || '');
        setPoNumber(initialData.poNumber || '');
        setPurpose(initialData.purpose || '');
        setControlNo(initialData.id || '');
        setLocation(initialData.location || '');
        setRequestType(initialData.requestType || 'ARALINKS');
        setDateOfRequest(initialData.date || getTodayIso());
        setProgram(initialData.program || '');
        setRemarks(initialData.remarks || '');
        setSelectedSchool(initialData.schoolName);
        setRequestedItems(initialData.items || []);
      } else {
        setRequestedBy('');
        setTicketNumber('');
        setPoNumber('');
        setPurpose('');
        setControlNo('ARALINKS-');
        setLocation('');
        setRequestType('ARALINKS');
        setProgram('');
        setRemarks('');
        setSelectedSchool('Select a School');
        setDateOfRequest(getTodayIso());
        
        // Handle pre-fill from Inventory
        if (prefillItem && prefillCode) {
          setRequestedItems([{
            id: Math.random().toString(36).substr(2, 9),
            qty: '1',
            uom: 'UNIT',
            item: prefillItem,
            code: prefillCode
          }]);
        } else {
          setRequestedItems([]);
        }
      }
    }
  }, [isOpen, initialData, fetchSchools, fetchEquipment, prefillItem, prefillCode]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    if (!program) {
      showWarning('Program Required', 'Please select a Program before adding item lines.');
      return;
    }
    setRequestedItems([...requestedItems, { id: Math.random().toString(36).substr(2, 9), qty: '', uom: '', item: '', code: '' }]);
  };

  const handleApplyBundle = (bundleName: string) => {
    if (!bundleName) return;
    setPendingBundle(bundleName);
    setBundleQuantity('1');
  };

  const confirmApplyBundle = async () => {
    if (!program || !isSupabaseConfigured || !pendingBundle) return;

    const multiplier = parseInt(bundleQuantity) || 1;

    try {
      const { data, error } = await supabase
        .from('bundle_items')
        .select('*')
        .eq('program', program)
        .eq('bundle', pendingBundle);

      if (error) throw error;
      if (data && data.length > 0) {
        const nextItems = [...requestedItems];
        
        (data as any[]).forEach(bundleItem => {
          const bundleItemUom = bundleItem.uom || 'SET';
          const addQtyValue = (bundleItem.quantity || 1) * multiplier;
          
          const existingIndex = nextItems.findIndex(i => 
            i.code === bundleItem.code && 
            i.uom.trim().toUpperCase() === bundleItemUom.trim().toUpperCase()
          );
          
          if (existingIndex !== -1) {
            const currentQty = parseInt(nextItems[existingIndex].qty) || 0;
            nextItems[existingIndex].qty = (currentQty + addQtyValue).toString();
          } else {
            nextItems.push({
              id: Math.random().toString(36).substr(2, 9),
              qty: addQtyValue.toString(),
              uom: bundleItemUom, 
              item: bundleItem.description,
              code: bundleItem.code
            });
          }
        });
        
        setRequestedItems(nextItems);
      }
      setPendingBundle(null);
      setSelectedBundleDropdown('');
    } catch (err) {
      console.error('Error applying bundle:', err);
      showError('Error', 'Failed to load bundle items.');
    }
  };

  const handleRemoveItem = (id: string) => {
    setRequestedItems(requestedItems.filter(item => item.id !== id));
  };

  const isItemValid = (item: RequestedItem) => {
    const qty = parseInt(item.qty) || 0;
    return qty > 0 && item.uom.trim() !== '' && item.item.trim() !== '' && item.code.trim() !== '';
  };

  const areAllItemsValid = requestedItems.length > 0 && requestedItems.every(isItemValid);

  const handleItemUpdate = (id: string | number, field: keyof RequestedItem, value: any) => {
    setRequestedItems(prev => {
      let updatedItems = prev.map(item => {
        if (item.id !== id) return item;

        if (field === 'qty') {
          return { ...item, qty: value.replace(/[^0-9]/g, '') };
        }

        if (field === 'item') {
          const selectedEquip = equipmentList.find(e => e.description === value);
          return { 
            ...item, 
            item: value, 
            code: selectedEquip ? selectedEquip.code : '',
            is_serialized: selectedEquip ? selectedEquip.is_serialized : false
          };
        }

        return { ...item, [field]: value };
      });

      // CONSOLIDATION LOGIC: Check for duplicates if we changed Item or UOM
      if (field === 'item' || field === 'uom') {
        const target = updatedItems.find(i => i.id === id);
        if (target && target.code && target.uom) {
          const existingIndex = updatedItems.findIndex(i => 
            i.id !== id && 
            i.code === target.code && 
            i.uom.trim().toUpperCase() === target.uom.trim().toUpperCase()
          );

          if (existingIndex !== -1) {
            const existing = updatedItems[existingIndex];
            const newQty = (parseInt(existing.qty) || 0) + (parseInt(target.qty) || 0);
            
            // Update the existing row and remove the current one
            updatedItems[existingIndex] = { ...existing, qty: newQty.toString() };
            return updatedItems.filter(i => i.id !== id);
          }
        }
      }

      return updatedItems;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        showWarning('File Too Large', 'File is too large. Max size is 5MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    setHasAttemptedSubmit(true);
    
    // --- COMPREHENSIVE VALIDATION ---
    if (!requestedBy.trim()) {
      showWarning('Missing Field', 'Requested By is required.');
      return;
    }
    if (!selectedSchool || selectedSchool === 'Select a School') {
      showWarning('Missing Field', 'Please select a School Name.');
      return;
    }
    if (!purpose.trim()) {
      showWarning('Missing Field', 'Purpose of request is required.');
      return;
    }
    if (!controlNo.trim() || controlNo.trim() === 'ARALINKS-') {
      showWarning('Missing Field', 'Control Number is required.');
      return;
    }
    if (!dateOfRequest.trim()) {
      showWarning('Missing Field', 'Date of Request is required.');
      return;
    }
    if (!location.trim()) {
      showWarning('Missing Field', 'Storage/Assignment Location is required.');
      return;
    }
    if (!program.trim()) {
      showWarning('Missing Field', 'Program is required.');
      return;
    }

    if (requestedItems.length === 0) {
      showWarning('Missing Items', 'Please add at least one item to the request.');
      return;
    }

    if (!areAllItemsValid) {
      showWarning('Incomplete Items', 'Please complete all required item fields.');
      const firstInvalidIndex = requestedItems.findIndex(item => !isItemValid(item));
      if (firstInvalidIndex !== -1) {
        const element = document.getElementById(`item-row-${requestedItems[firstInvalidIndex].id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let attachment_url = initialData?.attachment || null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${controlNo.trim()}-${Date.now()}.${fileExt}`;
        const filePath = `requests/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('attachment')
          .upload(filePath, selectedFile);

        if (uploadError) {
          throw uploadError;
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('attachment')
            .getPublicUrl(filePath);
          attachment_url = publicUrl;
        }
      }

      const currentUser = localStorage.getItem('aralinks_user') || 'System';
      const now = new Date().toISOString();

      const selectedSchoolData = schools.find(s => s.name === selectedSchool);
      const isSelectedSchoolBuffer = selectedSchoolData?.is_buffer === true || String(selectedSchoolData?.is_buffer) === 'true';

      const payload = {
        control_no: controlNo.trim(),
        school_name: selectedSchool,
        buffer_school: isSelectedSchoolBuffer ? selectedSchool : null,
        location: location.trim(),
        request_type: requestType,
        date: dateOfRequest,
        requested_by: requestedBy.trim(),
        ticket_no: ticketNumber.trim() || null,
        po_number: poNumber.trim() || null,
        status: initialData?.status || 'Pending',
        purpose: purpose.trim(),
        program: program,
        remarks: remarks.trim(),
        attachment: attachment_url,
        updated_by: currentUser,
        updated_at: now
      };

      console.log("Submitting payload to item_requests:", payload);

      let requestControlNo = '';

      if (initialData) {
        const { data: updatedRequest, error: updateError } = await supabase
          .from('item_requests')
          .update(payload)
          .eq('control_no', initialData.id)
          .select()
          .single();
          
        if (updateError) {
          console.error("Update Request Error:", updateError);
          throw updateError;
        }
        
        requestControlNo = updatedRequest.control_no;
        console.log("Request updated successfully:", updatedRequest);
      } else {
        const { data: newRequest, error: insertError } = await supabase
          .from('item_requests')
          .insert([payload])
          .select()
          .single();
          
        if (insertError) {
          console.error("Insert Request Error:", insertError);
          throw insertError;
        }
        
        requestControlNo = newRequest.control_no;
        console.log("Request created successfully:", newRequest);
      }

      // --- SAFETY VALIDATION ---
      if (!requestControlNo) {
        throw new Error("Invalid control number. Cannot save items.");
      }

      // --- HANDLE ITEMS ---
      console.log("Deleting existing items for:", requestControlNo);
      const { error: deleteError } = await supabase
        .from('request_items')
        .delete()
        .eq('request_control_no', requestControlNo);
      
      if (deleteError) {
        console.error("Delete Items Error:", deleteError);
        throw deleteError;
      }
      
      if (requestedItems.length > 0) {
        const itemsPayload = requestedItems.map(item => {
          const base: any = {
            request_control_no: requestControlNo,
            qty: parseInt(item.qty) || 0,
            uom: item.uom,
            item: item.item,
            code: item.code,
            is_serialized: item.is_serialized || false
          };

          // If it's an existing item (has a numeric ID), preserve its metadata
          // This ensures we don't wipe out delivery status or serials during an edit
          if (typeof item.id === 'number') {
            const existingItem = item as any;
            if (existingItem.status) base.status = existingItem.status;
            if (existingItem.received_quantity !== undefined) base.received_quantity = existingItem.received_quantity;
            if (existingItem.serials) base.serials = existingItem.serials;
          }

          return base;
        });
        
        console.log("Items to insert (with preserved metadata):", itemsPayload);
        
        const { data: insertedItems, error: itemsInsertError } = await supabase
          .from('request_items')
          .insert(itemsPayload)
          .select();
          
        if (itemsInsertError) {
          console.error("Insert Items Error:", itemsInsertError);
          throw itemsInsertError;
        }
        
        console.log("Items saved successfully:", insertedItems);
      }

      showSuccess('Success', initialData ? 'Requisition updated successfully' : 'Requisition created and synced successfully');
      if (onSubmit) onSubmit();
      
      setTimeout(() => {
        onClose();
      }, 500);

    } catch (err: any) {
      console.error('Submission Error:', err);
      showError('Error', err.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSchoolData = schools.find(s => s.name === selectedSchool);
  const isSelectedSchoolBuffer = selectedSchoolData?.is_buffer === true || String(selectedSchoolData?.is_buffer) === 'true';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      
      {pendingBundle && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20" onClick={() => setPendingBundle(null)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-[400px] rounded-2xl shadow-2xl border border-orange-400 p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Enter Multiplier for {pendingBundle}</h3>
            <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-800 mb-4"></div>
            
            <div className="space-y-1.5 mb-6">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Multiplier (e.g., 2 sets)</label>
              <input 
                type="text" 
                inputMode="numeric"
                value={bundleQuantity}
                onChange={(e) => setBundleQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                autoFocus
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none transition-all shadow-sm"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPendingBundle(null)}
                className="px-4 py-2 text-slate-400 font-medium uppercase tracking-wider hover:text-slate-600 transition-all text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={confirmApplyBundle}
                className="px-8 py-2.5 bg-[#FE4E02] text-white rounded-xl font-bold text-sm shadow-lg shadow-[#FE4E02]/20 active:scale-95 transition-all uppercase tracking-wider"
              >
                Apply Bundle
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative bg-white dark:bg-slate-900 w-full max-w-[850px] h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white font-poppins tracking-tight">
            {toTitleCase(initialData ? 'Edit Item Request' : 'Add Item Request')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500">
            <X size={20} sm:size={24} />
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-4">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="text-red-800 font-bold uppercase text-[10px] tracking-wider mb-0.5">Upload Error</h4>
                <p className="text-red-600 text-xs font-medium leading-relaxed whitespace-pre-line">{errorMessage}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 p-4 sm:p-5 bg-[#FE4E02]/5 dark:bg-[#FE4E02]/10 rounded-xl border border-[#FE4E02]/10 dark:border-[#FE4E02]/20">
            <label className="text-[10px] font-medium text-[#FE4E02]/60 uppercase tracking-wider">{toTitleCase("Pick Request Type *")}</label>
            <div className="flex flex-row items-center justify-center gap-6 sm:gap-10">
              <button 
                type="button"
                onClick={() => setRequestType('ARALINKS')}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <div className={`w-4 h-4 sm:w-5 sm:h-5 border-2 border-[#FE4E02] flex items-center justify-center transition-all ${requestType === 'ARALINKS' ? 'bg-[#FE4E02] text-white' : 'bg-white dark:bg-slate-800 text-transparent'}`}>
                  <span className="font-bold text-[10px] sm:text-xs leading-none">X</span>
                </div>
                <span className={`text-xs sm:text-sm font-medium uppercase tracking-wider transition-all ${requestType === 'ARALINKS' ? 'text-[#FE4E02]' : 'text-slate-400 dark:text-slate-500'}`}>ARALINKS</span>
              </button>

              <button 
                type="button"
                onClick={() => setRequestType('SMS-PROTRACK')}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <div className={`w-4 h-4 sm:w-5 sm:h-5 border-2 border-[#FE4E02] flex items-center justify-center transition-all ${requestType === 'SMS-PROTRACK' ? 'bg-[#FE4E02] text-white' : 'bg-white dark:bg-slate-800 text-transparent'}`}>
                  <span className="font-bold text-[10px] sm:text-xs leading-none">X</span>
                </div>
                <span className={`text-xs sm:text-sm font-medium uppercase tracking-wider transition-all ${requestType === 'SMS-PROTRACK' ? 'text-[#FE4E02]' : 'text-slate-400 dark:text-slate-500'}`}>SMS-PROTRACK</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Requested By")} <span className="text-[#FE4E02]">*</span></label>
              <input 
                type="text" 
                placeholder="Name of requester"
                value={requestedBy} 
                onChange={(e) => {
                  const val = e.target.value.replace(/[0-9]/g, '');
                  setRequestedBy(val);
                }} 
                required
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none transition-all shadow-sm font-medium" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("School Name")} <span className="text-[#FE4E02]">*</span></label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropdownDirection(window.innerHeight - rect.bottom < 250 ? 'up' : 'down');
                    setIsDropdownOpen(!isDropdownOpen);
                  }}
                  className={`w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border ${isDropdownOpen ? 'border-orange-400 ring-2 ring-orange-400/20' : 'border-slate-300 dark:border-slate-700'} rounded-lg text-sm text-left focus:outline-none transition-all shadow-sm font-medium flex items-center justify-between group overflow-hidden`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={selectedSchool === 'Select a School' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-white font-medium'}>
                      {selectedSchool}
                    </span>
                    {selectedSchool !== 'Select a School' && (
                      isSelectedSchoolBuffer ? (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 dark:bg-orange-500/10 text-[#FE4E02] text-[8px] font-bold rounded-full uppercase tracking-widest border border-orange-100 dark:border-orange-500/20 shrink-0">
                          <Zap size={8} fill="currentColor" /> Buffer
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold rounded-full uppercase tracking-widest border border-emerald-100 dark:border-emerald-500/20 shrink-0">
                          <ShieldCheck size={8} /> Active
                        </div>
                      )
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180 text-orange-400' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className={`absolute z-[130] left-0 right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in ${dropdownDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200`}>
                    <div className="max-h-[200px] md:max-h-[260px] overflow-y-auto py-2">
                      {schools.length > 0 ? (
                        schools.map((school, i) => {
                          const isBufferActual = school.is_buffer === true || String(school.is_buffer) === 'true';
                          return (
                            <div
                              key={`${school.name}-${i}`}
                              onClick={() => { setSelectedSchool(school.name); setIsDropdownOpen(false); }}
                              className={`px-4 md:px-5 py-3 flex items-center justify-between group cursor-pointer transition-colors ${
                                selectedSchool === school.name 
                                  ? 'bg-[#FE4E02]/10 dark:bg-slate-700' 
                                  : 'hover:bg-[#FE4E02]/5 dark:hover:bg-slate-700'
                              }`}
                            >
                              <span className={`text-xs md:text-[14px] font-bold ${
                                selectedSchool === school.name 
                                  ? 'text-[#FE4E02] dark:text-white' 
                                  : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                              }`}>
                                {school.name}
                              </span>
                              {isBufferActual ? (
                                <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-orange-50 dark:bg-orange-500/10 text-[#FE4E02] text-[7px] md:text-[8px] font-bold rounded-full uppercase tracking-wider border border-orange-100 dark:border-orange-500/20 group-hover:bg-[#FE4E02] group-hover:text-white transition-all">
                                  <Zap size={8} md:size={10} fill="currentColor" /> Buffer
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[7px] md:text-[8px] font-bold rounded-full uppercase tracking-wider border border-emerald-100 dark:border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                  <ShieldCheck size={8} md:size={10} /> Active
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-5 py-4 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                          No schools found.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Purpose of request")} <span className="text-[#FE4E02]">*</span></label>
              <input 
                type="text" 
                placeholder="Reason for requisition..."
                value={purpose} 
                onChange={(e) => setPurpose(e.target.value)} 
                required
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none transition-all shadow-sm font-medium" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Control No.")} <span className="text-[#FE4E02]">*</span></label>
              <input 
                type="text" 
                placeholder="ARALINKS-0000"
                value={controlNo} 
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.startsWith('ARALINKS-')) {
                    setControlNo(value);
                  } else {
                    setControlNo('ARALINKS-');
                  }
                }} 
                required
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none transition-all disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 shadow-sm font-medium tracking-normal" 
                disabled={!!initialData} 
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Date of Request")} <span className="text-[#FE4E02]">*</span></label>
              <div className="relative group">
                <input 
                  type="date" 
                  value={dateOfRequest} 
                  onChange={(e) => setDateOfRequest(e.target.value)} 
                  required
                  className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none transition-all shadow-sm font-medium" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("PO Number")}</label>
              <input 
                type="text" 
                placeholder="Optional PO reference"
                value={poNumber} 
                onChange={(e) => setPoNumber(e.target.value)} 
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none transition-all shadow-sm font-medium" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Storage/Assignment Location")} <span className="text-[#FE4E02]">*</span></label>
              <div className="relative" ref={locationDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropdownDirection(window.innerHeight - rect.bottom < 250 ? 'up' : 'down');
                    setIsLocationDropdownOpen(!isLocationDropdownOpen);
                  }}
                  className={`w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border ${isLocationDropdownOpen ? 'border-orange-400 ring-2 ring-orange-400/20' : 'border-slate-300 dark:border-slate-700'} rounded-lg text-sm text-left focus:outline-none transition-all shadow-sm font-medium flex items-center justify-between group`}
                >
                  <span className={location === '' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-white font-medium'}>
                    {location || 'Select Location'}
                  </span>
                  <ChevronDown size={16} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isLocationDropdownOpen ? 'rotate-180 text-orange-400' : ''}`} />
                </button>

                {isLocationDropdownOpen && (
                  <div className={`absolute z-[130] left-0 right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'} border rounded-xl shadow-xl overflow-hidden animate-in fade-in ${dropdownDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-black'
                  }`}>
                    <div className="max-h-[200px] overflow-y-auto py-2">
                      {locations.map((loc) => (
                        <div
                          key={loc.id}
                          onClick={() => { setLocation(loc.name); setIsLocationDropdownOpen(false); }}
                          className={`px-4 md:px-5 py-3 text-xs md:text-sm font-bold cursor-pointer transition-colors ${
                            location === loc.name
                              ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-[#FE4E02]/10 text-[#FE4E02]')
                              : (isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-[#FE4E02]/5 hover:text-slate-900')
                          }`}
                        >
                          {loc.name}
                        </div>
                      ))}
                      
                      <div className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} mt-1`}>
                        {isAddingNewLocation ? (
                          <div className="px-4 py-3 flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Location name..."
                              value={newLocationInput}
                              onChange={(e) => setNewLocationInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleQuickAddLocation();
                                if (e.key === 'Escape') setIsAddingNewLocation(false);
                              }}
                              className={`flex-1 h-8 px-2 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-[#FE4E02] ${
                                isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'
                              }`}
                            />
                            <button 
                              onClick={handleQuickAddLocation}
                              disabled={!newLocationInput.trim()}
                              className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-50"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => setIsAddingNewLocation(false)}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsAddingNewLocation(true);
                            }}
                            className={`w-full px-4 md:px-5 py-3 text-xs md:text-sm font-bold flex items-center gap-2 transition-colors ${
                              isDarkMode ? 'text-orange-400 hover:bg-slate-700' : 'text-[#FE4E02] hover:bg-[#FE4E02]/5'
                            }`}
                          >
                            <Plus size={14} />
                            <span>Add new location...</span>
                          </button>
                        )}
                      </div>

                      {locations.length === 0 && (
                        <div className="px-4 py-3 text-xs text-slate-400 italic">No locations found.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Ticket Number")}</label>
              <input 
                type="text" 
                placeholder="Optional ticket reference"
                value={ticketNumber} 
                onChange={(e) => setTicketNumber(e.target.value)} 
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none transition-all shadow-sm font-medium" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Program")} <span className="text-[#FE4E02]">*</span></label>
              <div className="relative" ref={programDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropdownDirection(window.innerHeight - rect.bottom < 250 ? 'up' : 'down');
                    setIsProgramDropdownOpen(!isProgramDropdownOpen);
                  }}
                  className={`w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border ${isProgramDropdownOpen ? 'border-orange-400 ring-2 ring-orange-400/20' : 'border-slate-300 dark:border-slate-700'} rounded-lg text-sm text-left focus:outline-none transition-all shadow-sm font-medium flex items-center justify-between group`}
                >
                  <span className={program === '' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-white font-medium'}>
                    {program || 'Select a Program'}
                  </span>
                  <ChevronDown size={16} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isProgramDropdownOpen ? 'rotate-180 text-orange-400' : ''}`} />
                </button>

                {isProgramDropdownOpen && (
                  <div className={`absolute z-[130] left-0 right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'} border rounded-xl shadow-xl overflow-hidden animate-in fade-in ${dropdownDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-black'
                  }`}>
                    <div className="max-h-[200px] overflow-y-auto py-2">
                      {['ACE', 'HUB', 'NGS', 'TEACH'].map((prog) => (
                        <div
                          key={prog}
                          onClick={() => {
                            setProgram(prog);
                            setSelectedBundleDropdown('');
                            setIsProgramDropdownOpen(false);
                          }}
                          className={`px-4 md:px-5 py-3 text-xs md:text-sm font-bold cursor-pointer transition-colors ${
                            program === prog
                              ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-[#FE4E02]/10 text-[#FE4E02]')
                              : (isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-[#FE4E02]/5 hover:text-slate-900')
                          }`}
                        >
                          {prog}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {program && availableBundles.length > 0 && (
                <div className="mt-4 md:mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={14} md:size={16} className="text-[#FE4E02] fill-[#FE4E02]/20" />
                    <span className="text-[9px] md:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Apply Bundle Configuration</span>
                  </div>
                  <div className="relative" ref={bundleDropdownRef}>
                    <div className="absolute inset-0 border-2 border-dashed border-[#FE4E02]/30 rounded-full pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setIsBundleDropdownOpen(!isBundleDropdownOpen)}
                      className="w-full pl-10 md:pl-12 pr-10 md:pr-12 py-3 md:py-3.5 bg-transparent text-[#FE4E02] rounded-full text-[11px] md:text-sm font-bold uppercase tracking-wider focus:outline-none cursor-pointer hover:bg-[#FE4E02]/5 transition-all text-left truncate flex items-center justify-between"
                    >
                      <span className="truncate">
                        {isLoadingBundles ? 'Syncing Bundles...' : selectedBundleDropdown || 'Select Bundle to Add'}
                      </span>
                      <ChevronDown size={14} md:size={16} className={`text-[#FE4E02] transition-transform duration-200 ${isBundleDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isBundleDropdownOpen && (
                      <div className={`absolute z-[130] left-0 right-0 mt-2 border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-black'
                      }`}>
                        <div className="max-h-[200px] overflow-y-auto py-2">
                          <div
                            onClick={() => {
                              setSelectedBundleDropdown('');
                              setIsBundleDropdownOpen(false);
                            }}
                            className={`px-4 py-2.5 text-xs md:text-sm font-bold cursor-pointer transition-colors ${
                              selectedBundleDropdown === ''
                                ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-[#FE4E02]/10 text-[#FE4E02]')
                                : (isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-[#FE4E02]/5 hover:text-slate-900')
                            }`}
                          >
                            SELECT BUNDLE TO ADD
                          </div>
                          {availableBundles.map((bundle) => (
                            <div
                              key={bundle}
                              onClick={() => {
                                setSelectedBundleDropdown(bundle);
                                handleApplyBundle(bundle);
                                setIsBundleDropdownOpen(false);
                              }}
                              className={`px-4 py-2.5 text-xs md:text-sm font-bold cursor-pointer transition-colors ${
                                selectedBundleDropdown === bundle
                                  ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-[#FE4E02]/10 text-[#FE4E02]')
                                  : (isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-[#FE4E02]/5 hover:text-slate-900')
                              }`}
                            >
                              {bundle}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Remarks / Additional Notes")}</label>
              <div className="relative group">
                <textarea 
                  placeholder="Any special instructions or comments... (Optional)"
                  value={remarks} 
                  onChange={(e) => setRemarks(e.target.value)} 
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none transition-all shadow-sm font-medium resize-none h-20" 
                />
                <Notebook className="absolute right-3 top-3 text-slate-300 dark:text-slate-600 group-focus-within:text-orange-400 transition-colors" size={16} />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{toTitleCase("Items List")} <span className="text-[#FE4E02]">*</span></h3>
              <button 
                onClick={handleAddItem} 
                disabled={!program}
                className={`w-full sm:w-auto px-4 py-2 border rounded-lg font-medium text-xs transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider
                  ${program 
                    ? 'border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-white' 
                    : 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50'
                  }`}
              >
                <Plus size={14} />
                <span>Add Item Line</span>
              </button>
            </div>

            <div className="space-y-4 pb-40">
              {requestedItems.map((item) => {
                const isQtyValid = (parseInt(item.qty) || 0) > 0;
                const isUomValid = item.uom.trim() !== '';
                const isItemValidDesc = item.item.trim() !== '';
                
                const showQtyError = hasAttemptedSubmit && !isQtyValid;
                const showUomError = hasAttemptedSubmit && !isUomValid;
                const showItemError = hasAttemptedSubmit && !isItemValidDesc;

                return (
                  <div 
                    key={item.id} 
                    id={`item-row-${item.id}`}
                    className={`flex flex-col sm:flex-row items-stretch sm:items-end gap-4 p-3 border rounded-xl group animate-in slide-in-from-left-4 duration-300 transition-colors
                    ${(showQtyError || showUomError || showItemError)
                      ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20' 
                      : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700'}
                  `}>
                    <div className="flex gap-4">
                      <div className="flex-1 sm:flex-none space-y-1.5">
                        <label className={`text-[10px] font-medium uppercase px-1 tracking-wider ${showQtyError ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                          {toTitleCase("Qty")}
                        </label>
                        <input 
                          type="text" 
                          placeholder="0" 
                          value={item.qty} 
                          inputMode="numeric"
                          onChange={(e) => handleItemUpdate(item.id, 'qty', e.target.value)} 
                          className={`w-full sm:w-16 h-9 px-2 border rounded-lg text-sm bg-white dark:bg-slate-800 focus:border-orange-400 outline-none shadow-sm font-medium text-center text-slate-700 dark:text-white transition-all ${
                            showQtyError ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-500/10' : 'border-slate-300 dark:border-slate-700'
                          }`} 
                        />
                        {showQtyError && <p className="text-[8px] font-medium text-red-500 uppercase tracking-tighter px-1">Required</p>}
                      </div>
                      <div className="flex-1 sm:flex-none space-y-1.5">
                        <label className={`text-[10px] font-medium uppercase px-1 tracking-wider ${showUomError ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          {toTitleCase("Uom *")}
                        </label>
                        <div className="relative" ref={el => uomDropdownRefs.current[item.id] = el}>
                          <button
                            type="button"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDropdownDirection(window.innerHeight - rect.bottom < 200 ? 'up' : 'down');
                              setOpenUomDropdownId(openUomDropdownId === item.id ? null : item.id);
                              setOpenItemDropdownId(null);
                            }}
                            className={`w-full sm:w-24 h-9 px-3 border rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none shadow-sm font-medium transition-all text-left flex items-center justify-between ${
                              showUomError ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-500/10' : 'border-slate-300 dark:border-slate-700'
                            } ${openUomDropdownId === item.id ? 'border-orange-400 ring-2 ring-orange-400/20' : ''}`}
                          >
                            <span className={item.uom === '' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-white font-medium'}>
                              {item.uom || 'UOM'}
                            </span>
                            <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openUomDropdownId === item.id ? 'rotate-180 text-orange-400' : ''}`} />
                          </button>

                          {openUomDropdownId === item.id && (
                            <div className={`absolute z-[130] left-0 right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'} border rounded-xl shadow-xl overflow-hidden animate-in fade-in ${dropdownDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200 ${
                              isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-black'
                            }`}>
                              <div className="max-h-[150px] overflow-y-auto py-1">
                                {['SET', 'PC/S', 'KIT'].map((uom) => (
                                  <div
                                    key={uom}
                                    onClick={() => { handleItemUpdate(item.id, 'uom', uom); setOpenUomDropdownId(null); }}
                                    className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${
                                      item.uom === uom
                                        ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-[#FE4E02]/10 text-[#FE4E02]')
                                        : (isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-[#FE4E02]/5 hover:text-slate-900')
                                    }`}
                                  >
                                    {uom}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {showUomError && <p className="text-[8px] font-medium text-red-500 uppercase tracking-tighter px-1">Required</p>}
                      </div>
                    </div>
                    <div className="flex-grow space-y-1.5 sm:ml-4">
                      <label className={`text-[10px] font-medium uppercase px-1 tracking-wider ${showItemError ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        {toTitleCase("Item Description")}
                      </label>
                      <div className="relative" ref={el => itemDropdownRefs.current[item.id] = el}>
                        <button
                          type="button"
                          disabled={isLoadingEquip}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownDirection(window.innerHeight - rect.bottom < 250 ? 'up' : 'down');
                            setOpenItemDropdownId(openItemDropdownId === item.id ? null : item.id);
                            setOpenUomDropdownId(null);
                          }}
                          className={`w-full h-9 px-3 border rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none shadow-sm font-medium transition-all text-left flex items-center justify-between ${
                            showItemError ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-500/10' : 'border-slate-300 dark:border-slate-700'
                          } ${openItemDropdownId === item.id ? 'border-orange-400 ring-2 ring-orange-400/20' : ''} ${isLoadingEquip ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className={`truncate ${item.item === '' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-white font-medium'}`}>
                            {isLoadingEquip ? 'Loading Catalog...' : item.item || 'Select Equipment'}
                          </span>
                          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openItemDropdownId === item.id ? 'rotate-180 text-orange-400' : ''}`} />
                        </button>

                        {openItemDropdownId === item.id && (
                          <div className={`absolute z-[130] left-0 right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'} border rounded-xl shadow-xl overflow-hidden animate-in fade-in ${dropdownDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200 ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-black'
                          }`}>
                            <div className="max-h-[200px] overflow-y-auto py-2">
                              {equipmentList.map((equip, i) => (
                                <div
                                  key={`${equip.code}-${i}`}
                                  onClick={() => { handleItemUpdate(item.id, 'item', equip.description); setOpenItemDropdownId(null); }}
                                  className={`px-4 py-2.5 flex items-center justify-between group cursor-pointer transition-colors ${
                                    item.item === equip.description
                                      ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-[#FE4E02]/10 text-[#FE4E02]')
                                      : (isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-[#FE4E02]/5 hover:text-slate-900')
                                  }`}
                                >
                                  <span className="text-xs font-bold">{equip.description}</span>
                                  {equip.is_serialized && (
                                    <span className="text-[8px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full uppercase tracking-wider border border-amber-200 dark:border-amber-500/30">
                                      Serializable
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {showItemError && <p className="text-[8px] font-medium text-red-500 uppercase tracking-tighter px-1">Required</p>}
                    </div>
                    <div className="flex items-end gap-4 shrink-0">
                      <div className="flex-grow sm:w-32 space-y-1.5">
                        <label className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase px-1 tracking-wider">{toTitleCase("Item Code")}</label>
                        <input 
                          type="text" 
                          placeholder="Auto-filled" 
                          value={item.code} 
                          readOnly
                          className="w-full h-9 px-3 border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-mono cursor-not-allowed shadow-inner" 
                        />
                      </div>
                      <button onClick={() => handleRemoveItem(item.id)} className="p-2 mb-0.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all shrink-0">
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {requestedItems.length === 0 && (
                <div className="text-center py-12 md:py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[1.5rem] md:rounded-[2.5rem] text-slate-400 dark:text-slate-600 flex flex-col items-center gap-3">
                  <div className="p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full">
                    <FileText size={24} md:size={32} className="text-slate-200 dark:text-slate-700" />
                  </div>
                  <p className="font-bold uppercase tracking-widest text-[10px] md:text-xs">{toTitleCase("No Items Listed Yet")}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="px-6 py-2 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider hover:text-slate-800 dark:hover:text-white transition-colors disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting || requestedItems.length === 0 || !areAllItemsValid} 
            className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium text-sm tracking-wide shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 uppercase"
          >
            {toTitleCase(isSubmitting ? 'Processing...' : initialData ? 'Update Request' : 'Add Request')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewRequestModal;
