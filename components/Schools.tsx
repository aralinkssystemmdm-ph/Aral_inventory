
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Trash2, School, Plus, Loader2, ArrowUp, X, Check, Edit3, Filter, ChevronDown, CheckSquare, Square, Download, Activity, Clock, Users, Upload, FileSpreadsheet, Eye, Info, AlertCircle, FileUp, ShieldCheck, MapPin, Zap } from 'lucide-react';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { toTitleCase } from '../lib/utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface SchoolRecord {
  id: string;
  name: string;
  location?: string;
  is_buffer: boolean;
  created_at: string;
}

interface SchoolsProps {
  isDarkMode?: boolean;
}

const Schools: React.FC<SchoolsProps> = ({ isDarkMode = false }) => {
  const { showSuccess, showError, showDelete } = useNotification();
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [editingSchool, setEditingSchool] = useState<SchoolRecord | null>(null);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [isBuffer, setIsBuffer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Delete Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Import States
  const [dragActive, setDragActive] = useState(false);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSchools = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) setSchools(data as SchoolRecord[]);
    } catch (err) {
      console.error('Error fetching schools:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools(true);

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('schools-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, () => fetchSchools(false))
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchSchools]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setShowScrollTop(containerRef.current.scrollTop > 300);
      }
    };
    const container = containerRef.current;
    if (container) container.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  // CSV Parsing Logic
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
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
      const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
      if (rows.length < 1) {
        setImportError("CSV file appears to be empty.");
        return;
      }

      const headerRow = rows[0];
      const headers = headerRow.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('school') || h.includes('name'));
      const locIdx = headers.findIndex(h => h.includes('location'));

      if (nameIdx === -1) {
        setImportError("CSV must contain a 'School' column.");
        return;
      }

      const seenNames = new Set<string>();
      const data = rows.slice(1).map(row => {
        const columns: string[] = [];
        let current = "";
        let inQuotes = false;
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            columns.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        columns.push(current.trim());

        const name = columns[nameIdx]?.replace(/^"|"$/g, '').trim() || '';
        const loc = locIdx !== -1 ? columns[locIdx]?.replace(/^"|"$/g, '').trim() || '' : '';

        if (name && !seenNames.has(name.toUpperCase())) {
          seenNames.add(name.toUpperCase());
          return { name, location: loc };
        }
        return null;
      }).filter((item): item is { name: string, location: string } => item !== null);

      if (data.length === 0) {
        setImportError("No valid unique records found in the file.");
      }
      setParsedData(data);
    } catch (err) {
      console.error(err);
      setImportError("Failed to parse CSV file structure.");
    }
  };

  const triggerBulkImport = () => {
    setIsAdding(true);
    setActiveTab('import');
    setEditingSchool(null);
    setImportedFile(null);
    setParsedData([]);
    setIsBuffer(false);
    
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fileInputRef.current?.click();
    }, 100);
  };

  const handleAddSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSaving(true);
    
    try {
      if (activeTab === 'manual') {
        const trimmed = newSchoolName.trim();
        if (!trimmed) throw new Error("School name is required");

        const { error } = await supabase.from('schools').insert([{ 
          name: trimmed, 
          location: newLocation.trim(),
          is_buffer: isBuffer 
        }]);
        if (error) {
          if (error.message.includes('unique constraint')) throw new Error("This school already exists.");
          throw error;
        }
      } else {
        if (parsedData.length === 0) throw new Error("No data to import.");
        
        const finalData = parsedData.map(item => ({ 
          name: item.name, 
          location: item.location,
          is_buffer: false 
        }));

        const { error } = await supabase.from('schools').upsert(finalData, { onConflict: 'name' });
        if (error) throw error;
        
        showSuccess('Success', `${finalData.length} schools imported successfully`);
      }

      setNewSchoolName('');
      setNewLocation('');
      setIsBuffer(false);
      setImportedFile(null);
      setParsedData([]);
      setIsAdding(false);
      if (activeTab === 'manual') {
        showSuccess('Success', 'School registered successfully');
      }
      fetchSchools(false);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to save school.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSchool = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editingSchool || !newSchoolName.trim()) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ 
          name: newSchoolName.trim(), 
          location: newLocation.trim(),
          is_buffer: isBuffer
        })
        .eq('id', editingSchool.id);
      
      if (error) throw error;
      
      showSuccess('Success', 'School details updated successfully');
      setEditingSchool(null);
      setNewSchoolName('');
      setNewLocation('');
      setIsBuffer(false);
      fetchSchools(false);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to update school.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!isSupabaseConfigured) return;
    
    setIsDeleting(true);
    try {
      if (isBulkDeleting) {
        const { error } = await supabase
          .from('schools')
          .delete()
          .in('id', Array.from(selectedIds));
        if (error) throw error;
        showDelete('Deleted', `${selectedIds.size} schools have been removed.`);
        setSelectedIds(new Set());
      } else if (schoolToDelete) {
        const { error } = await supabase
          .from('schools')
          .delete()
          .eq('id', schoolToDelete.id);
        if (error) throw error;
        showDelete('Deleted', 'School has been removed.');
      }
      
      setIsDeleteModalOpen(false);
      await fetchSchools(false);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to delete school.');
    } finally {
      setIsDeleting(false);
      setIsBulkDeleting(false);
      setSchoolToDelete(null);
    }
  };

  const triggerBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    setSchoolToDelete(null);
    setIsDeleteModalOpen(true);
  };

  const handleSelectAll = () => {
    if (filteredSchools.length === 0) return;
    if (selectedIds.size === filteredSchools.length) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set<string>();
      filteredSchools.forEach(s => newSelected.add(s.id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const downloadDirectoryCSV = () => {
    const csvContent = "School,Location\n";
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Aralinks_Schools_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredSchools = useMemo(() => {
    return schools.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (s.location || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [schools, searchQuery]);

  const stats = useMemo(() => {
    const total = schools.length;
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const recent = schools.filter(s => new Date(s.created_at) >= last30Days).length;
    return { total, recent };
  }, [schools]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500 relative">
      <div className="grid grid-cols-12 gap-4 md:gap-5 mb-6">
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <div className="bg-[#0081f1] rounded-[1.2rem] md:rounded-[1.5rem] p-5 md:p-6 text-white shadow-3xl shadow-blue-500/20 flex flex-col justify-between h-[150px] md:h-[180px] relative overflow-hidden group">
            <div className="flex items-center gap-3 md:gap-4 relative z-10">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl md:rounded-xl flex items-center justify-center backdrop-blur-md group-hover:scale-110 transition-transform">
                <Users size={20} md:size={24} />
              </div>
              <div>
                <p className="text-[8px] md:text-[9px] font-bold tracking-widest text-white/50">{toTitleCase('Registered Schools')} </p>
                <h4 className="text-xl md:text-2xl font-bold tracking-tight">{stats.total}</h4>
              </div>
            </div>
            <School size={100} md:size={130} className="absolute -right-4 -bottom-4 md:-right-6 md:-bottom-6 opacity-10 rotate-12" strokeWidth={1} />
          </div>
        </div>
        
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <div className="bg-[#FE4E02] rounded-[1.2rem] md:rounded-[1.5rem] p-5 md:p-6 text-white shadow-3xl shadow-orange-500/20 flex flex-col justify-between h-[150px] md:h-[180px] relative overflow-hidden group">
            <div className="flex items-center gap-3 md:gap-4 relative z-10">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl md:rounded-xl flex items-center justify-center backdrop-blur-md group-hover:scale-110 transition-transform">
                <Activity size={20} md:size={24} />
              </div>
              <div>
                <p className="text-[8px] md:text-[9px] font-bold tracking-widest text-white/50">{toTitleCase('Newly Registered Schools')}</p>
                <h4 className="text-xl md:text-2xl font-bold tracking-tight">{stats.recent}</h4>
              </div>
            </div>
            <Activity size={100} md:size={130} className="absolute -right-4 -bottom-4 md:-right-6 md:-bottom-6 opacity-10 rotate-12" strokeWidth={1} />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 h-full">
              <div 
                onClick={downloadDirectoryCSV}
                className={`rounded-[1.2rem] md:rounded-[1.5rem] p-5 md:p-6 shadow-2xl border flex flex-col justify-between cursor-pointer group hover:bg-[#0081f1] transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-50'
                }`}
              >
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-xl flex items-center justify-center group-hover:bg-white transition-all shadow-sm ${
                  isDarkMode ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-[#0081f1]'
                }`}>
                   <Download size={20} md:size={24} />
                </div>
                <div className="mt-3 md:mt-0">
                  <h4 className={`text-sm md:text-base font-bold group-hover:text-white tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{toTitleCase('Export Template')}</h4>
                  <p className={`text-[8px] md:text-[9px] font-bold group-hover:text-white/60 tracking-widest mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{toTitleCase('Download Registry Template')}</p>
                </div>
              </div>

              <div 
                onClick={triggerBulkImport}
                className={`rounded-[1.2rem] md:rounded-[1.5rem] p-5 md:p-6 shadow-2xl border flex flex-col justify-between cursor-pointer group hover:bg-[#FE4E02] transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-50'
                }`}
              >
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-xl flex items-center justify-center group-hover:bg-white transition-all shadow-sm ${
                  isDarkMode ? 'bg-slate-700 text-orange-400' : 'bg-orange-50 text-[#FE4E02]'
                }`}>
                   <FileUp size={20} md:size={24} />
                </div>
                <div className="mt-3 md:mt-0">
                  <h4 className={`text-sm md:text-base font-bold group-hover:text-white tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{toTitleCase('Bulk Import')}</h4>
                  <p className={`text-[8px] md:text-[9px] font-bold group-hover:text-white/60 tracking-widest mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{toTitleCase('Mass Upload Directory')}</p>
                </div>
           </div>
        </div>
      </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="relative group w-full lg:w-fit">
          <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-[#FE4E02]' : 'text-slate-400 group-focus-within:text-[#FE4E02]'}`}>
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Search school registry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-11 pr-4 py-3 w-full lg:w-80 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FE4E02]/20 focus:border-[#FE4E02] transition-all font-medium text-sm ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' 
                : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
            }`}
          />
        </div>
        
        <div className="flex items-center w-full lg:w-auto gap-3">
          <button 
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedIds(new Set());
            }}
            className={`w-full lg:w-fit px-4 py-2 rounded-full text-sm font-bold border transition-all active:scale-95 flex items-center justify-center gap-2 ${
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

          <button 
            disabled={!isSupabaseConfigured || isAdding}
            onClick={() => { 
              setIsAdding(true); 
              setEditingSchool(null); 
              setNewSchoolName(''); 
              setNewLocation(''); 
              setIsBuffer(false);
              setActiveTab('manual'); 
              if (formRef.current) {
                formRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }} 
            className="w-full lg:w-fit bg-[#FE4E02] hover:bg-[#E04502] text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider text-xs shadow-lg shadow-[#FE4E02]/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Register School
          </button>
        </div>
      </div>

      {(isAdding || editingSchool) && (
        <div ref={formRef} className={`rounded-[1.5rem] md:rounded-[2.0rem] p-6 md:p-8 mb-10 border shadow-3xl animate-in slide-in-from-top-4 duration-500 ${
          isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4 md:gap-5">
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1.2rem] flex items-center justify-center ${
                editingSchool 
                  ? (isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-[#0081f1]') 
                  : (isDarkMode ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-[#FE4E02]')
              }`}>
                {editingSchool ? <Edit3 size={20} md:size={24} /> : <School size={20} md:size={24} />}
              </div>
              <div>
                <h3 className={`text-base md:text-lg font-black tracking-tight mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                  {toTitleCase(editingSchool ? 'Update School Details' : 'Register New School')}
                </h3>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 tracking-widest">{toTitleCase('Operational Directory Management')}</p>
              </div>
            </div>
            {!editingSchool && (
              <div className={`flex p-1 rounded-[1rem] md:rounded-[1.2rem] shadow-lg w-fit ${isDarkMode ? 'bg-slate-900' : 'bg-[#1a1a1a]'}`}>
                <button onClick={() => { setActiveTab('manual'); }} className={`px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-bold tracking-widest transition-all ${activeTab === 'manual' ? 'bg-[#FE4E02] text-white shadow-lg' : 'text-white/40'}`}>{toTitleCase('Manual Entry')}</button>
                <button onClick={() => { setActiveTab('import'); }} className={`px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-bold tracking-widest transition-all ${activeTab === 'import' ? 'bg-[#0081f1] text-white shadow-lg' : 'text-white/40'}`}>{toTitleCase('Batch Sync')}</button>
              </div>
            )}
          </div>

          <form onSubmit={editingSchool ? handleUpdateSchool : handleAddSubmit} className="space-y-5 md:space-y-6">
            {(activeTab === 'manual' || editingSchool) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[11px] font-bold text-slate-400 tracking-[0.2em] px-2">{toTitleCase('Official School Name')}</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g. Saint Jude Catholic School"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    className={`w-full px-4 md:px-5 py-2.5 md:py-3 border rounded-xl md:rounded-[1.2rem] text-sm md:text-base font-bold outline-none transition-all shadow-inner ${
                      isDarkMode 
                        ? 'bg-slate-900 border-slate-700 text-slate-100 focus:bg-slate-900 focus:border-blue-500 focus:ring-blue-500/5' 
                        : 'bg-slate-50 border-slate-100 text-slate-800 focus:bg-white focus:border-[#0081f1] focus:ring-[#0081f1]/5'
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[11px] font-bold text-slate-400 tracking-[0.2em] px-2">{toTitleCase('Location')}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Manila City / Silang"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className={`w-full px-4 md:px-5 py-2.5 md:py-3 border rounded-xl md:rounded-[1.2rem] text-sm md:text-base font-bold outline-none transition-all shadow-inner ${
                      isDarkMode 
                        ? 'bg-slate-900 border-slate-700 text-slate-100 focus:bg-slate-900 focus:border-orange-500 focus:ring-orange-500/5' 
                        : 'bg-slate-50 border-slate-100 text-slate-800 focus:bg-white focus:border-[#FE4E02] focus:ring-[#FE4E02]/5'
                    }`}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-5 px-2 md:px-4">
                  <button
                    type="button"
                    onClick={() => setIsBuffer(!isBuffer)}
                    className={`flex items-center justify-center gap-2.5 px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-[1.2rem] font-bold text-[10px] md:text-xs tracking-widest transition-all shadow-lg active:scale-95 border-2 w-full sm:w-fit
                      ${isBuffer 
                        ? 'bg-[#FE4E02] text-white border-[#FE4E02] shadow-[#FE4E02]/20' 
                        : (isDarkMode 
                            ? 'bg-slate-900 text-slate-500 border-slate-700 hover:border-orange-500/30 hover:text-slate-300' 
                            : 'bg-white text-slate-400 border-slate-100 hover:border-[#FE4E02]/30 hover:text-slate-600')
                      }
                    `}
                  >
                    {isBuffer ? <Zap size={16} fill="currentColor" /> : <School size={16} />}
                    {toTitleCase(isBuffer ? 'Buffer School Active' : 'Set as Buffer School')}
                  </button>
                  <p className="text-[8px] md:text-[9px] font-bold text-slate-400 tracking-widest max-w-full sm:max-w-[180px] leading-relaxed">
                    {toTitleCase('Toggle to mark this partner as a strategic reserve school.')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {!importedFile ? (
                  <div 
                    className={`relative border-2 border-dashed rounded-[3.5rem] p-16 flex flex-col items-center justify-center text-center transition-all cursor-pointer group
                      ${dragActive 
                        ? (isDarkMode ? 'border-blue-500 bg-blue-500/5' : 'border-[#0081f1] bg-[#0081f1]/5') 
                        : (isDarkMode ? 'border-slate-700 bg-slate-900 hover:border-blue-500/50 hover:bg-slate-800/50' : 'border-slate-200 bg-slate-50 hover:border-[#0081f1]/50 hover:bg-slate-100/50')
                      }
                    `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
                    <div className="w-20 h-20 bg-[#0081f1] text-white rounded-[1.5rem] flex items-center justify-center mb-6 transition-all shadow-2xl shadow-[#0081f1]/20 group-hover:scale-110"><Upload size={40} /></div>
                    <p className={`font-bold text-xl tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{toTitleCase('Drop CSV file here')}</p>
                    <p className="text-slate-400 text-[11px] font-bold tracking-widest mt-2">{toTitleCase('Required Columns: "School", "Location"')}</p>
                  </div>
                ) : (
                  <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className={`flex items-center justify-between border p-6 rounded-[2rem] shadow-sm ${
                         isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'
                       }`}>
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><FileSpreadsheet size={28} /></div>
                          <div>
                            <p className={`font-bold text-lg tracking-tight truncate max-w-[200px] ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{importedFile.name}</p>
                            <p className="text-emerald-600 text-[10px] font-bold tracking-widest">{parsedData.length} {toTitleCase('records detected')}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => { setImportedFile(null); setParsedData([]); }} className="p-3 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={24} /></button>
                      </div>

                      <div className={`flex items-center gap-6 px-8 py-6 rounded-[2rem] border shadow-inner group transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'
                      }`}>
                         <div className="w-12 h-12 rounded-[1.25rem] border-2 border-emerald-500 bg-emerald-500 text-white flex items-center justify-center shadow-md">
                            <ShieldCheck size={24} />
                         </div>
                          <div className="flex flex-col">
                             <span className={`text-[14px] font-bold tracking-widest ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{toTitleCase('Import Policy')}</span>
                             <p className="text-[11px] font-bold text-emerald-600 tracking-wider">
                                {toTitleCase('ALL IMPORTED SCHOOLS ARE ACTIVE')}
                             </p>
                          </div>
                      </div>
                    </div>

                    <div className={`rounded-[2.5rem] border overflow-hidden shadow-inner ${
                      isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <div className={`px-8 py-5 border-b flex items-center justify-between ${
                        isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white/50 border-slate-100'
                      }`}>
                        <div className="flex items-center gap-3">
                          <Eye size={18} className="text-[#0081f1]" />
                          <span className="text-[11px] font-bold text-slate-500 tracking-[0.2em]">{toTitleCase('Batch Sync Preview')}</span>
                        </div>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead className={`sticky top-0 z-10 shadow-sm ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                            <tr>
                              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 tracking-widest w-20">{toTitleCase('No.')}</th>
                              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 tracking-widest">{toTitleCase('School')}</th>
                              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 tracking-widest">{toTitleCase('Location')}</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700 bg-slate-900' : 'divide-slate-100 bg-white'}`}>
                            {parsedData.map((row, i) => (
                              <tr key={i} className={`group transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                                <td className="px-8 py-4 text-[13px] font-bold text-slate-300 group-hover:text-[#0081f1] transition-colors">{i + 1}</td>
                                <td className={`px-8 py-4 text-[14px] font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>{row.name}</td>
                                <td className={`px-8 py-4 text-[14px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{row.location || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                
                {importError && (
                  <div className={`flex items-start gap-4 p-6 rounded-[2rem] animate-in slide-in-from-top-2 border ${
                    isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100'
                  }`}>
                    <AlertCircle size={24} className="shrink-0" />
                    <p className="text-sm font-bold leading-relaxed">{importError}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-4">
              <button 
                type="button"
                onClick={() => { setIsAdding(false); setEditingSchool(null); setNewSchoolName(''); setNewLocation(''); setIsBuffer(false); setImportedFile(null); setParsedData([]); }}
                className={`px-6 py-3 font-bold tracking-widest transition-all text-xs ${
                  isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {toTitleCase('Dismiss')}
              </button>
              <button 
                type="submit"
                disabled={isSaving || (activeTab === 'manual' ? !newSchoolName.trim() : parsedData.length === 0)}
                className={`px-8 py-3 text-white rounded-xl md:rounded-[1.2rem] font-bold text-xs tracking-[0.2em] shadow-2xl active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2.5
                  ${editingSchool || activeTab === 'import' ? 'bg-[#0081f1] hover:bg-blue-600 shadow-blue-500/30' : 'bg-[#FE4E02] hover:bg-[#E04502] shadow-orange-500/30'}
                `}
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                {toTitleCase(editingSchool ? 'Commit Update' : activeTab === 'manual' ? 'Register School' : `Sync ${parsedData.length} Partners`)}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={`rounded-lg shadow-sm overflow-hidden border flex flex-col mb-10 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {loading ? (
          <div className="flex-grow flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-[#FE4E02]" size={40} />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Directory...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
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
                        {selectedIds.size === filteredSchools.length && filteredSchools.length > 0 ? <CheckSquare size={16} className="text-[#FE4E02]" /> : <Square size={16} className={isDarkMode ? 'text-slate-700' : 'text-slate-200'} />}
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">School Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Location</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center w-48">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-50'}`}>
                {filteredSchools.map((school, i) => {
                  const isSelected = selectedIds.has(school.id);
                  const isBufferActual = school.is_buffer === true || String(school.is_buffer) === 'true';

                  return (
                    <tr 
                      key={school.id} 
                      style={{ animationDelay: `${i * 50}ms` }}
                      className={`group animate-ease-in-down transition-all duration-200 border-l-4 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:shadow-sm hover:scale-[1.005] cursor-pointer ${
                        isSelected 
                          ? (isDarkMode ? 'bg-blue-500/10 border-l-[#0081f1]' : 'bg-[#0081f1]/5 border-l-[#0081f1]') 
                          : 'border-l-transparent'
                      }`}
                    >
                      {isSelectionMode && (
                        <td className="px-4 py-3 md:py-4">
                          <button 
                            onClick={() => toggleSelection(school.id)}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-[#0081f1] border-[#0081f1] text-white' 
                                : (isDarkMode ? 'border-slate-700 text-slate-700 hover:border-[#0081f1]' : 'border-slate-200 text-slate-200 hover:border-[#0081f1]')
                            }`}
                          >
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3 md:py-4">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center group-hover:bg-[#0081f1]/10 group-hover:text-[#0081f1] group-hover:rotate-[360deg] transition-all duration-500 ${
                            isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-50 text-slate-400'
                          }`}>
                            <School size={16} md:size={18} />
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-xs md:text-sm font-bold tracking-tight group-hover:text-[#0081f1] transition-colors ${
                              isDarkMode ? 'text-slate-100' : 'text-slate-800'
                            }`}>{school.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                               <ShieldCheck size={10} className="text-slate-300" />
                               <span className="text-[8px] md:text-[9px] font-bold text-slate-400 tracking-widest">{toTitleCase('Global Partner')}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 md:py-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <div className="flex items-center gap-2 md:gap-3">
                          <MapPin size={12} md:size={14} className="text-[#FE4E02] group-hover:animate-pulse" />
                          <span className="text-xs font-bold tracking-wider">
                            {school.location || toTitleCase('NOT DEFINED')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 md:py-4">
                        <div className="flex justify-center">
                          {isBufferActual ? (
                            <div className={`flex items-center gap-2 px-3 md:px-4 py-1 md:py-1.5 border rounded-full w-fit shadow-sm group-hover:scale-110 transition-transform ${
                              isDarkMode ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-[#FE4E02] border-orange-100'
                            }`}>
                               <Zap size={10} md:size={12} fill="currentColor" />
                               <span className="text-[8px] md:text-[9px] font-bold tracking-[0.15em]">{toTitleCase('Buffer School')}</span>
                            </div>
                          ) : (
                            <div className={`flex items-center gap-2 px-3 md:px-4 py-1 md:py-1.5 border rounded-full w-fit shadow-sm group-hover:scale-110 transition-transform ${
                              isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                               <ShieldCheck size={10} md:size={12} />
                               <span className="text-[8px] md:text-[9px] font-bold tracking-[0.15em]">{toTitleCase('Active')}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 md:py-4">
                        <div className="flex items-center justify-center gap-2 md:gap-3">
                          <button 
                            onClick={() => {
                              setEditingSchool(school);
                              setNewSchoolName(school.name);
                              setNewLocation(school.location || '');
                              setIsBuffer(school.is_buffer);
                              setIsAdding(false);
                              formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className={`p-2 md:p-2.5 rounded-lg md:rounded-xl transition-all active:scale-95 group/btn ${
                              isDarkMode ? 'text-slate-500 hover:text-blue-400 hover:bg-blue-400/10' : 'text-slate-300 hover:text-[#0081f1] hover:bg-[#0081f1]/5'
                            }`}
                            title="Edit Details"
                          >
                            <Edit3 size={16} md:size={18} className="group-hover/btn:scale-110 transition-transform" />
                          </button>
                          <button 
                            onClick={() => { setSchoolToDelete(school); setIsBulkDeleting(false); setIsDeleteModalOpen(true); }}
                            className={`p-2 md:p-2.5 rounded-lg md:rounded-xl transition-all active:scale-95 group/btn ${
                              isDarkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                            }`}
                            title="Remove Partner"
                          >
                            <Trash2 size={16} md:size={18} className="group-hover/btn:scale-110 transition-transform" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredSchools.length === 0 && !loading && (
              <div className="flex-grow flex flex-col items-center justify-center py-40 opacity-20">
                 <School size={120} strokeWidth={1} className="mb-8" />
                 <p className="text-xl font-bold tracking-[0.5em]">{toTitleCase("No Partners Found")}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FLOATING ACTION BAR FOR SCHOOLS */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 sm:bottom-12 left-1/2 -translate-x-1/2 z-[80] bg-[#1a1a1a] px-6 sm:px-12 py-4 sm:py-6 rounded-2xl sm:rounded-[3rem] shadow-3xl border border-white/10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 animate-in slide-in-from-bottom-10 duration-500 w-[90%] sm:w-auto">
           <div className="flex flex-col items-center text-center">
              <span className="text-[8px] sm:text-[10px] font-bold text-white/40 tracking-[0.25em]">{toTitleCase("Registry Selection")}</span>
              <span className="text-lg sm:text-2xl font-bold text-white tracking-tight">{selectedIds.size} {toTitleCase("Schools")}</span>
           </div>
           <div className="hidden sm:block w-[1px] h-10 bg-white/10"></div>
           <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <button 
                onClick={triggerBulkDelete}
                className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 text-[8px] sm:text-[11px] font-bold tracking-widest shadow-2xl shadow-red-500/30 transition-all active:scale-95"
              >
                <Trash2 size={14} sm:size={18} />
                {toTitleCase("Delete Registry")}
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

      <DeleteConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setSchoolToDelete(null); setIsBulkDeleting(false); }}
        onConfirm={handleConfirmDelete}
        controlNo={schoolToDelete?.name || ''}
        schoolName={schoolToDelete?.location || ''}
        isDeleting={isDeleting}
        itemCount={isBulkDeleting ? selectedIds.size : undefined}
        isDarkMode={isDarkMode}
        type="school"
      />
    </div>
  );
};

export default Schools;
