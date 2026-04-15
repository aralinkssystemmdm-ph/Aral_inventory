import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, Loader2, AlertCircle, FileSpreadsheet, Info, Eye, Trash2, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface AddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any;
  isDarkMode?: boolean;
}

const AddEquipmentModal: React.FC<AddEquipmentModalProps> = ({ isOpen, onClose, onSubmit, initialData, isDarkMode = false }) => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [formData, setFormData] = useState({ itemCode: '', description: '', status: 'ACTIVE', isSerializable: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  
  // Dropdown States
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isSerializableDropdownOpen, setIsSerializableDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const serializableDropdownRef = useRef<HTMLDivElement>(null);
  
  // Import States
  const [dragActive, setDragActive] = useState(false);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (serializableDropdownRef.current && !serializableDropdownRef.current.contains(event.target as Node)) {
        setIsSerializableDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setImportedFile(null);
      setParsedData([]);
      setImportError(null);
      setCodeError(null);
      setActiveTab(initialData ? 'manual' : 'manual');
      if (initialData) {
        setFormData({
          itemCode: initialData.code,
          description: initialData.description,
          status: initialData.status || 'ACTIVE',
          isSerializable: initialData.is_serialized || false
        });
      } else {
        setFormData({ itemCode: '', description: '', status: 'ACTIVE', isSerializable: false });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  // File Upload Logic
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setImportError("Please upload a valid CSV file.");
      return;
    }
    setImportedFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    try {
      // Split by newline, handling both \n and \r\n
      const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
      if (rows.length < 1) {
        setImportError("CSV file appears to be empty.");
        return;
      }

      // Detect delimiter: Check if the first row uses tabs or commas
      const firstRow = rows[0];
      const commaCount = (firstRow.match(/,/g) || []).length;
      const tabCount = (firstRow.match(/\t/g) || []).length;
      const delimiter = tabCount > commaCount ? '\t' : ',';

      // Helper to split CSV row correctly handling quotes and delimiters within quotes
      const splitCSVRow = (row: string) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
      };

      // Headers are expected in the first row
      const headers = splitCSVRow(rows[0]).map(h => h.toUpperCase());
      
      // Extremely flexible header matching
      const codeIdx = headers.findIndex(h => h === 'CODE' || h === 'ITEM CODE' || h.includes('CODE'));
      const descIdx = headers.findIndex(h => h.includes('DESCRIPTION') || h === 'ITEM' || h === 'NAME');
      
      // Prioritize "SERIALIZED" or "SERIALIZABLE" over just "SERIAL" to avoid matching "SERIAL NUMBER"
      let serializableIdx = headers.findIndex(h => h.includes('SERIALIZED') || h.includes('SERIALIZABLE'));
      if (serializableIdx === -1) {
        serializableIdx = headers.findIndex(h => h.includes('SERIAL'));
      }

      if (codeIdx === -1 || descIdx === -1 || serializableIdx === -1) {
        setImportError("CSV must contain columns for: CODE, Description, and Serialized (YES/NO)");
        return;
      }

      const seenCodes = new Set<string>();
      const data = rows.slice(1).map((row, index) => {
        const cleanedCols = splitCSVRow(row);
        
        const code = cleanedCols[codeIdx]?.trim() || '';
        const description = cleanedCols[descIdx]?.trim() || '';
        const isSerializableStr = cleanedCols[serializableIdx]?.trim().toUpperCase();
        
        // Skip empty rows
        if (!code && !description) return null;

        const isSerializable = isSerializableStr === 'YES' || isSerializableStr === 'TRUE' || isSerializableStr === 'Y';
        const isNotSerializable = isSerializableStr === 'NO' || isSerializableStr === 'FALSE' || isSerializableStr === 'N';

        // Validation: Invalid Serializable value
        if (!isSerializable && !isNotSerializable) {
          throw new Error(`Row ${index + 2}: Serialized column must be YES or NO (found: "${isSerializableStr || 'empty'}")`);
        }

        // Only return if code and description exist and code is unique in this file
        if (code && description && !seenCodes.has(code.toUpperCase())) {
          seenCodes.add(code.toUpperCase());
          return {
            code: code,
            description: description,
            status: 'ACTIVE',
            is_serialized: isSerializable
          };
        }
        return null;
      }).filter((item): item is any => item !== null);

      if (data.length === 0) {
        setImportError("No valid unique records found in the file.");
      }
      setParsedData(data);
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Failed to parse CSV file structure.");
    }
  };

  const removeFile = () => {
    setImportedFile(null);
    setParsedData([]);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const checkCodeExists = async (code: string) => {
    const { data, error } = await supabase
      .from('equipment')
      .select('code')
      .eq('code', code.trim())
      .maybeSingle();
    
    return data !== null;
  };

  const addEquipment = async () => {
    const { itemCode: code, description, status: rawStatus, isSerializable } = formData;

    // 3. Validation: code and description are required
    if (!code.trim() || !description.trim()) {
      showError('Validation Error', 'Item Code and Description are required.');
      return;
    }

    // 6. UI Behavior: Prevent multiple clicks
    if (isSubmitting) return;

    setIsSubmitting(true);
    setCodeError(null);

    try {
      // 2. Transform values before insert
      // Map is_serialized: YES -> true, NO -> false
      const is_serialized = isSerializable;

      // Ensure status is "Active" or "Inactive" (capitalize first letter)
      const status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

      // 4. Add console logs before insert
      console.log('Inserting equipment:', { code: code.trim(), description: description.trim(), status, is_serialized });

      // 4. Insert using Supabase
      const { error } = await supabase
        .from('equipment')
        .insert([
          {
            code: code.trim(),
            description: description.trim(),
            status: status,
            is_serialized: is_serialized
          }
        ]);

      // 5. Handle response
      if (error) {
        // Log full error object
        console.error('Supabase Insert Error:', error);
        
        // Handle specific unique constraint error
        if (error.code === '23505') {
          setCodeError("A record with this code already exists.");
          return;
        }
        throw error;
      }

      // If success:
      showSuccess('Success', 'Equipment added successfully');
      
      // Reset form
      setFormData({ itemCode: '', description: '', status: 'ACTIVE', isSerializable: false });
      
      // Refresh table data
      onSubmit(formData);
      
      // Close modal
      onClose();

    } catch (err: any) {
      // If error: Show meaningful error message from Supabase
      console.error('Full Error Object:', err);
      showError('Error', err.message || 'An unexpected error occurred while adding equipment.');
    } finally {
      // 6. UI Behavior: Disable button while saving
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (activeTab === 'manual') {
      // For manual add, use the specific addEquipment function
      // If it's an edit, we still use the existing update logic but adapted if needed
      if (initialData) {
        // Keep existing update logic for initialData
        setIsSubmitting(true);
        try {
          const payload = {
            code: formData.itemCode.trim(),
            description: formData.description.trim(),
            status: formData.status.charAt(0).toUpperCase() + formData.status.slice(1).toLowerCase(),
            is_serialized: formData.isSerializable
          };
          const { error } = await supabase.from('equipment').update(payload).eq('code', initialData.code);
          if (error) throw error;
          showSuccess('Success', 'Equipment updated successfully');
          onSubmit(formData);
          onClose();
        } catch (err: any) {
          console.error('Update Error:', err);
          showError('Error', err.message || 'Failed to update equipment.');
        } finally {
          setIsSubmitting(false);
        }
      } else {
        await addEquipment();
      }
    } else {
      // Bulk Import logic
      setIsSubmitting(true);
      try {
        if (parsedData.length === 0) {
          showError('Error', 'No valid data found to import.');
          setIsSubmitting(false);
          return;
        }
        const { error } = await supabase.from('equipment').upsert(parsedData, { onConflict: 'code' });
        if (error) throw error;
        showSuccess('Success', `${parsedData.length} items imported successfully`);
        onSubmit(formData);
        onClose();
      } catch (err: any) {
        console.error('Bulk Import Error:', err);
        showError('Error', err.message || 'Failed to import equipment.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full max-w-[640px] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col h-full sm:h-auto max-h-screen ${
        isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
      }`}>
        
        {/* Header */}
        <div className="px-6 sm:px-10 pt-6 sm:pt-10 pb-4 sm:pb-6 flex items-center justify-between shrink-0">
          <div>
            <h2 className={`text-xl sm:text-2xl font-black font-poppins tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-[#323232]'}`}>
              {initialData ? 'Edit Equipment' : 'Manage Equipment'}
            </h2>
            <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-1">
              Catalog Master Records
            </p>
          </div>
          <button onClick={onClose} className={`p-2 sm:p-2.5 rounded-2xl transition-colors ${
            isDarkMode ? 'hover:bg-slate-800 text-slate-600' : 'hover:bg-slate-50 text-slate-300'
          }`}>
            <X size={20} sm:size={24} />
          </button>
        </div>

        {/* Tab Switcher */}
        {!initialData && (
          <div className={`px-6 sm:px-10 flex gap-1 border-b shrink-0 overflow-x-auto no-scrollbar ${
            isDarkMode ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <button 
              onClick={() => setActiveTab('manual')}
              className={`px-4 sm:px-6 py-3 text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'manual' ? 'text-[#FE4E02]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Manual Add
              {activeTab === 'manual' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FE4E02] rounded-t-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('import')}
              className={`px-4 sm:px-6 py-3 text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'import' ? 'text-[#0081f1]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Bulk Import
              {activeTab === 'import' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#0081f1] rounded-t-full" />}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 sm:px-10 py-6 sm:py-8 flex flex-col gap-6 overflow-hidden flex-grow">
          <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 max-h-full sm:max-h-[450px]">
            {activeTab === 'manual' ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[11px] sm:text-[12px] font-black text-slate-500 uppercase tracking-widest px-1">Item Code</label>
                  <input 
                    type="text" 
                    value={formData.itemCode} 
                    onChange={(e) => {
                        setFormData({...formData, itemCode: e.target.value});
                        if (codeError) setCodeError(null);
                    }} 
                    className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 border rounded-xl sm:rounded-2xl text-sm sm:text-[14px] font-bold outline-none transition-all disabled:opacity-50 ${
                      isDarkMode 
                        ? `bg-slate-950 text-slate-100 ${codeError ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-800 focus:border-[#FE4E02] focus:ring-4 focus:ring-[#FE4E02]/10'}` 
                        : `bg-slate-50 text-slate-800 ${codeError ? 'border-red-500 ring-4 ring-red-50' : 'border-slate-200 focus:border-[#FE4E02] focus:ring-4 focus:ring-[#FE4E02]/5'}`
                    }`} 
                    disabled={!!initialData}
                    placeholder="e.g. LPT-001"
                  />
                  {codeError && (
                    <div className="flex items-center gap-2 px-2 animate-in slide-in-from-top-1">
                      <AlertCircle size={14} className="text-red-500 shrink-0" />
                      <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">{codeError}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] sm:text-[12px] font-black text-slate-500 uppercase tracking-widest px-1">Description</label>
                  <input 
                    type="text" 
                    value={formData.description} 
                    onChange={(e) => setFormData({...formData, description: e.target.value})} 
                    className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 border rounded-xl sm:rounded-2xl text-sm sm:text-[14px] font-bold focus:border-[#FE4E02] focus:ring-4 focus:ring-[#FE4E02]/5 outline-none transition-all ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100 focus:bg-slate-950' : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white'
                    }`} 
                    placeholder="Enter detailed item name..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[11px] sm:text-[12px] font-black text-slate-500 uppercase tracking-widest px-1">Status</label>
                    <div className="relative" ref={statusDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                        className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 border rounded-xl sm:rounded-2xl text-sm sm:text-[14px] font-bold text-left focus:outline-none transition-all flex items-center justify-between ${
                          isDarkMode 
                            ? `bg-slate-950 border-slate-800 text-slate-100 ${isStatusDropdownOpen ? 'border-[#FE4E02] ring-4 ring-[#FE4E02]/10' : ''}` 
                            : `bg-slate-50 border-slate-200 text-slate-800 ${isStatusDropdownOpen ? 'border-[#FE4E02] ring-4 ring-[#FE4E02]/5' : ''}`
                        }`}
                      >
                        <span className="uppercase tracking-wider">{formData.status}</span>
                        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180 text-[#FE4E02]' : ''}`} />
                      </button>
                      
                      {isStatusDropdownOpen && (
                        <div className={`absolute z-[130] left-0 right-0 mt-2 border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
                          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                        }`}>
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
                                  ? (isDarkMode ? 'bg-[#FE4E02]/10 text-[#FE4E02]' : 'bg-[#FE4E02]/5 text-[#FE4E02]') 
                                  : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-50')
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] sm:text-[12px] font-black text-slate-500 uppercase tracking-widest px-1">Is Serializable</label>
                    <div className="relative" ref={serializableDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsSerializableDropdownOpen(!isSerializableDropdownOpen)}
                        className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 border rounded-xl sm:rounded-2xl text-sm sm:text-[14px] font-bold text-left focus:outline-none transition-all flex items-center justify-between ${
                          isDarkMode 
                            ? `bg-slate-950 border-slate-800 text-slate-100 ${isSerializableDropdownOpen ? 'border-[#FE4E02] ring-4 ring-[#FE4E02]/10' : ''}` 
                            : `bg-slate-50 border-slate-200 text-slate-800 ${isSerializableDropdownOpen ? 'border-[#FE4E02] ring-4 ring-[#FE4E02]/5' : ''}`
                        }`}
                      >
                        <span className="uppercase tracking-wider">{formData.isSerializable ? 'YES' : 'NO'}</span>
                        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isSerializableDropdownOpen ? 'rotate-180 text-[#FE4E02]' : ''}`} />
                      </button>
                      
                      {isSerializableDropdownOpen && (
                        <div className={`absolute z-[130] left-0 right-0 mt-2 border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
                          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                        }`}>
                          {['YES', 'NO'].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                setFormData({...formData, isSerializable: option === 'YES'});
                                setIsSerializableDropdownOpen(false);
                              }}
                              className={`w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                                (formData.isSerializable ? 'YES' : 'NO') === option 
                                  ? (isDarkMode ? 'bg-[#FE4E02]/10 text-[#FE4E02]' : 'bg-[#FE4E02]/5 text-[#FE4E02]') 
                                  : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-50')
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {!importedFile ? (
                  <div 
                    className={`relative border-2 border-dashed rounded-[1.5rem] sm:rounded-[2.5rem] p-8 sm:p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer group
                      ${dragActive 
                        ? (isDarkMode ? 'border-blue-500 bg-blue-500/10' : 'border-[#0081f1] bg-[#0081f1]/5') 
                        : (isDarkMode ? 'border-slate-800 bg-slate-950 hover:border-blue-500/50 hover:bg-slate-900' : 'border-slate-200 bg-slate-50 hover:border-[#0081f1]/50 hover:bg-slate-100/50')
                      }
                    `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" className="hidden" accept=".csv" onChange={handleChange} />
                    
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#0081f1] text-white rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 transition-all shadow-lg shadow-[#0081f1]/20 group-hover:scale-110">
                      <Upload size={24} className="sm:hidden" />
                      <Upload size={32} className="hidden sm:block" />
                    </div>
                    
                    <div>
                      <p className={`font-black text-xs sm:text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Drop CSV file here or click to browse</p>
                      <p className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mt-1">Only .csv files supported</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl sm:rounded-2xl gap-4 border ${
                      isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'
                    }`}>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-md shrink-0">
                          <FileSpreadsheet size={20} />
                        </div>
                        <div className="min-w-0 flex-grow">
                          <p className={`font-black text-xs truncate max-w-full sm:max-w-[240px] ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{importedFile.name}</p>
                          <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest">{parsedData.length} unique records detected</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={removeFile}
                        className={`p-2 rounded-xl transition-all self-end sm:self-auto ${
                          isDarkMode ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-red-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>

                    <div className={`rounded-2xl sm:rounded-3xl border overflow-hidden ${
                      isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <div className={`px-4 sm:px-5 py-3 border-b flex items-center justify-between ${
                        isDarkMode ? 'border-slate-800' : 'border-slate-100'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Eye size={14} className="text-[#0081f1]" />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data Preview</span>
                        </div>
                      </div>
                      <div className="max-h-[260px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                          <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                            <tr>
                              <th className="px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                              <th className="px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                              <th className="px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serializable</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 bg-slate-950' : 'divide-slate-100 bg-white'}`}>
                            {parsedData.map((row, i) => (
                              <tr key={i} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-900' : 'hover:bg-slate-50'}`}>
                                <td className="px-5 py-3 text-xs font-black text-[#0081f1] font-mono">{row.code}</td>
                                <td className={`px-5 py-3 text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{row.description}</td>
                                <td className="px-5 py-3">
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${row.is_serialized ? 'text-amber-500' : 'text-slate-400'}`}>
                                    {row.is_serialized ? 'YES' : 'NO'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {importError && (
                  <div className={`flex items-start gap-3 p-4 rounded-2xl animate-in slide-in-from-top-2 border ${
                    isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100'
                  }`}>
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p className="text-xs font-bold leading-relaxed">{importError}</p>
                  </div>
                )}

                {!importedFile && (
                  <div className={`p-5 rounded-2xl border flex items-start gap-3 ${
                    isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <Info size={18} className="text-[#0081f1] shrink-0 mt-0.5" />
                    <div className="text-[11px] text-slate-500 leading-relaxed">
                      <p className={`font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>Unique Code Enforcement</p>
                      File must include <span className="text-[#FE4E02] font-black">Code</span> and <span className="text-[#FE4E02] font-black">Description</span>. Codes must be unique. Duplicate codes within the file will be filtered.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center gap-3 sm:gap-4">
            <button 
              type="button" 
              onClick={onClose} 
              className={`px-4 sm:px-8 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all active:scale-95 ${
                isDarkMode ? 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-400' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
              }`}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || (activeTab === 'import' && parsedData.length === 0)} 
              className={`flex-grow py-2.5 sm:py-3.5 text-white rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2
                ${activeTab === 'import' ? 'bg-[#0081f1] hover:bg-blue-600 shadow-blue-500/20' : 'bg-[#FE4E02] hover:bg-[#E04502] shadow-[#FE4E02]/20'}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : (activeTab === 'import' ? <FileSpreadsheet size={16} /> : <FileText size={16} />)}
              {isSubmitting ? 'Processing...' : (initialData ? 'Update Record' : (activeTab === 'import' ? `Sync ${parsedData.length} Records` : 'Add Equipment'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEquipmentModal;
