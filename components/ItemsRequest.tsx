
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Archive, Edit3, Loader2, FileText, Eye, ArrowUp, CheckSquare, Square, Filter, ChevronDown, Clock, MapPin, Tag, CheckCircle2, CalendarDays, X, Plus, Check } from 'lucide-react';
import { toTitleCase } from '../lib/utils';
import NewRequestModal from './NewRequestModal';
import RequestPreviewModal from './RequestPreviewModal';
import ItemVerificationModal from './ItemVerificationModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface ItemsRequestProps {
  onNavigate?: (viewId: string, params?: any) => void;
  highlightedId?: string;
  initialStatus?: StatusFilterType;
  isDarkMode?: boolean;
  prefillItem?: string;
  prefillCode?: string;
}

export interface RequestData {
  id: string; // control_no
  ticketNo?: string;
  schoolName: string;
  bufferSchool?: string;
  location?: string;
  requestType: 'ARALINKS' | 'SMS-PROTRACK';
  date: string;
  requestedBy: string;
  archivedBy?: string; 
  archivedAt?: string;
  status: 'Pending' | 'Delivered' | 'Partially Delivered';
  purpose?: string;
  program?: string;
  poNumber?: string | null;
  remarks?: string;
  items?: any[];
  attachment?: string;
  deliveredAt?: string;
}

type StatusFilterType = 'All' | 'Pending' | 'Partially' | 'Completed';

const ItemsRequest: React.FC<ItemsRequestProps> = ({ 
  highlightedId, 
  initialStatus, 
  isDarkMode = false,
  prefillItem,
  prefillCode
}) => {
  const { showSuccess, showError, showDelete } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<RequestData | null>(null);
  const [previewRequest, setPreviewRequest] = useState<RequestData | null>(null);
  const [verificationRequest, setVerificationRequest] = useState<RequestData | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<RequestData | null>(null);
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('All');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isMultiSelect, setIsMultiSelect] = useState(false);

  useEffect(() => {
    if (initialStatus) {
      setStatusFilter(initialStatus);
    }
  }, [initialStatus]);
  const [tempHighlightId, setTempHighlightId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  const [tempPoValue, setTempPoValue] = useState('');
  const [isSavingPo, setIsSavingPo] = useState(false);
  const isCancelingPo = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<{[key: string]: HTMLTableRowElement | null}>({});

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
    if (prefillItem || prefillCode) {
      setIsModalOpen(true);
    }
  }, [prefillItem, prefillCode]);

  const fetchRequests = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    
    if (showLoading) setLoading(true);
    
    try {
      const { data: bundleData } = await supabase
        .from('bundle_items')
        .select('code, bundle, program');

      const { data, error } = await supabase
        .from('item_requests')
        .select(`
          *,
          request_items (*)
        `)
        .not('status', 'in', '("Deleted","Rejected")')
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching requests:', error);
      } else if (data) {
        const mapped = data.map((req: any) => {
          let status: 'Pending' | 'Delivered' | 'Partially Delivered' = 'Pending';
          
          if (req.status === 'Delivered' || req.status === 'Partially Delivered') {
            status = req.status;
          } else if (req.status === 'Complete' || req.delivered_at) {
            status = 'Delivered';
          }
          
          return {
            id: req.control_no,
            ticketNo: req.ticket_no,
            schoolName: req.school_name,
            bufferSchool: req.buffer_school,
            location: req.location,
            requestType: (req.request_type || 'ARALINKS') as 'ARALINKS' | 'SMS-PROTRACK',
            date: req.date, 
            requestedBy: req.requested_by,
            status,
            purpose: req.purpose,
            program: req.program,
            poNumber: req.po_number,
            remarks: req.remarks,
            attachment: req.attachment,
            deliveredAt: req.delivered_at,
            items: req.request_items.map((item: any) => {
              const bundleInfo = bundleData?.find(b => b.code === item.code && b.program === req.program);
              return {
                id: item.id,
                qty: item.qty,
                uom: item.uom,
                item: item.item,
                code: item.code,
                bundle_name: bundleInfo ? bundleInfo.bundle : null,
                isSerializable: item.is_serialized,
                received_quantity: item.received_quantity,
                serials: item.serials || []
              };
            })
          } as RequestData;
        });
        setRequests(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests(true);

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('item-requests-realtime-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'item_requests' },
          () => fetchRequests(false)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchRequests]);

  useEffect(() => {
    if (highlightedId && !loading && requests.length > 0) {
      setSearchQuery('');
      
      const targetRequest = requests.find(r => r.id === highlightedId);
      if (targetRequest) {
        setStatusFilter(targetRequest.status);
        setTempHighlightId(highlightedId);
        
        setTimeout(() => {
          const targetRow = rowRefs.current[highlightedId];
          if (targetRow) {
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);

        const timer = setTimeout(() => {
          setTempHighlightId(null);
        }, 10000);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightedId, loading, requests]);

  const counts = useMemo(() => {
    return {
      All: requests.length,
      Pending: requests.filter(r => r.status === 'Pending').length,
      Partially: requests.filter(r => r.status === 'Partially Delivered').length,
      Completed: requests.filter(r => r.status === 'Delivered').length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let result = requests.filter(req => {
      const matchesSearch = searchQuery.trim() === '' || 
        req.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (req.ticketNo && req.ticketNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (req.poNumber && req.poNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        req.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.location && req.location.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (statusFilter === 'All') return matchesSearch;

      const internalStatus = 
        statusFilter === 'Pending' ? 'Pending' :
        statusFilter === 'Partially' ? 'Partially Delivered' :
        'Delivered';
      
      const matchesStatus = req.status === internalStatus;
      
      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      // If statusFilter is 'All', sort by status priority first
      if (statusFilter === 'All') {
        const statusPriority: Record<string, number> = {
          'Pending': 1,
          'Partially Delivered': 2,
          'Delivered': 3
        };
        const priorityA = statusPriority[a.status] || 99;
        const priorityB = statusPriority[b.status] || 99;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
      }

      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [requests, searchQuery, statusFilter, sortDirection]);

  const getStatusLabel = (status: string) => {
    if (status === 'Pending') return 'Pending';
    if (status === 'Partially Delivered') return 'Partially';
    if (status === 'Delivered') return 'Completed';
    return status;
  };

  const renderRequestRow = (req: RequestData, i: number) => {
    const isSelected = selectedIds.has(req.id);
    const isDelivered = req.status === 'Delivered';
    const isPartial = req.status === 'Partially Delivered';
    const isFinalized = isDelivered || isPartial;
    const isCompleting = completingId === req.id;
    const isHighlighted = tempHighlightId === req.id;
    
    return (
      <div 
        key={`${req.id}-${i}`}
        ref={el => { if (el) rowRefs.current[req.id] = el as any; }}
        style={{ animationDelay: `${i * 50}ms` }}
        className={`group animate-ease-in-down transition-all duration-200 border-l-4 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:shadow-sm hover:scale-[1.005] cursor-pointer flex items-center px-4 py-3 min-w-[1000px] lg:min-w-full ${
          deletingId === req.id ? 'opacity-50 grayscale pointer-events-none' : ''
        } ${isHighlighted ? 'highlight-entry-focus' : ''} ${isSelected ? 'bg-[#0081f1]/5 border-l-[#0081f1]' : 'border-l-transparent'}`}
        onClick={() => isMultiSelect ? toggleSelection(req.id) : setPreviewRequest(req) || setIsPreviewOpen(true)}
      >
        {isMultiSelect && (
          <div className="w-10 flex-shrink-0 flex justify-center" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => toggleSelection(req.id)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#0081f1] border-[#0081f1] text-white' : 'border-slate-200 dark:border-slate-700 text-slate-200 dark:text-slate-700 hover:border-[#0081f1]'}`}
            >
              {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
            </button>
          </div>
        )}
        <div className="flex-1 min-w-0 px-2 whitespace-nowrap">
          <div className="flex flex-col leading-tight">
             <span className="text-xs font-bold text-slate-800 dark:text-white tracking-tight group-hover:text-[#FE4E02] transition-colors whitespace-nowrap">{req.id}</span>
             <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase whitespace-nowrap">{req.requestType}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 px-2 whitespace-nowrap">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 tracking-wider whitespace-nowrap">
            {formatDate(req.date)}
          </span>
        </div>

        <div className="flex-1 min-w-0 px-2 whitespace-nowrap">
          {req.ticketNo ? (
            <span className="text-[10px] font-black text-[#FE4E02] tracking-widest uppercase whitespace-nowrap">{req.ticketNo}</span>
          ) : null}
        </div>

        <div className="flex-1 min-w-0 px-2" onClick={(e) => e.stopPropagation()}>
          {editingPoId === req.id ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={tempPoValue}
                onChange={(e) => setTempPoValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePo(req.id);
                  if (e.key === 'Escape') {
                    isCancelingPo.current = true;
                    setEditingPoId(null);
                  }
                }}
                onBlur={() => {
                  if (!isCancelingPo.current) {
                    handleSavePo(req.id);
                  }
                  isCancelingPo.current = false;
                }}
                autoFocus
                className="w-24 px-2 py-1 text-[10px] font-bold bg-white dark:bg-slate-800 border border-[#0081f1] rounded outline-none"
              />
              <button 
                onMouseDown={() => { isCancelingPo.current = false; }}
                onClick={() => handleSavePo(req.id)}
                disabled={isSavingPo}
                className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-colors"
              >
                {isSavingPo ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              </button>
              <button 
                onMouseDown={() => { isCancelingPo.current = true; }}
                onClick={() => {
                  setEditingPoId(null);
                  isCancelingPo.current = false;
                }}
                className="p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div 
              className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 py-1 rounded transition-colors group/po flex items-center gap-2 w-fit"
              onClick={() => {
                setEditingPoId(req.id);
                setTempPoValue(req.poNumber || '');
              }}
              title="Click to edit PO Number"
            >
              {req.poNumber ? (
                <span className="text-[10px] font-black text-[#0081f1] tracking-widest uppercase block">{req.poNumber}</span>
              ) : (
                <span className="text-[10px] text-slate-300 dark:text-slate-700 italic block">Add PO</span>
              )}
              <Edit3 size={10} className="text-slate-300 opacity-0 group-hover/po:opacity-100 transition-opacity shrink-0" />
            </div>
          )}
        </div>

        <div className="flex-[2] min-w-0 px-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight group-hover:text-slate-900 dark:group-hover:text-white transition-colors block">{req.schoolName}</span>
        </div>

        <div className="flex-1 min-w-0 px-2">
           <div className="flex items-center gap-1 w-full">
              <MapPin size={12} className="text-[#0081f1] shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider block">{req.location || 'Warehouse'}</span>
           </div>
        </div>

        <div className="flex-1 min-w-0 px-2 whitespace-nowrap">
          <span className="px-2 py-0.5 bg-slate-900 dark:bg-slate-800 text-white rounded-md text-[8px] font-bold tracking-widest w-fit shadow-sm group-hover:bg-[#FE4E02] transition-colors whitespace-nowrap uppercase">
            {req.program || 'GENERAL'}
          </span>
        </div>

        <div className="flex-1 min-w-0 px-2 whitespace-nowrap flex justify-center">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full w-fit border transition-all duration-300 group-hover:scale-105 whitespace-nowrap ${
            isDelivered ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' : 
            isPartial ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20' :
            'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20'
          }`}>
             {isFinalized ? <CheckCircle2 size={12} strokeWidth={2} className="shrink-0" /> : <Clock size={12} strokeWidth={2} className="shrink-0" />}
             <span className="text-xs font-bold tracking-wide whitespace-nowrap">{getStatusLabel(req.status)}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 px-2 whitespace-nowrap flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          {isDelivered ? (
            <button 
              onClick={() => { setVerificationRequest(req); setIsVerificationModalOpen(true); }}
              className="flex items-center gap-1 text-slate-500 hover:text-[#FE4E02] cursor-pointer text-sm transition-colors"
            >
              <Archive size={14} />
              <span>View History</span>
            </button>
          ) : (
            <>
              <button 
                onClick={() => { setPreviewRequest(req); setIsPreviewOpen(true); }}
                className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all active:scale-95"
                title="Preview Slip"
              >
                <Eye size={16} />
              </button>
              
              {!isFinalized && (
                <button 
                  onClick={() => { setEditingRequest(req); setIsModalOpen(true); }}
                  className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-[#0081f1] hover:bg-[#0081f1]/5 rounded-lg transition-all active:scale-95"
                  title="Edit Entry"
                >
                  <Edit3 size={16} />
                </button>
              )}

              {!isDelivered && (
                <button 
                  onClick={() => req.poNumber && handleCheckItems(req)}
                  disabled={isCompleting || !req.poNumber}
                  className={`p-1.5 rounded-lg transition-all active:scale-95 ${
                    !req.poNumber ? 'opacity-50 cursor-not-allowed text-slate-300 dark:text-slate-600' : 
                    isPartial ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20' : 
                    'text-slate-300 dark:text-slate-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                  }`}
                  title={!req.poNumber ? 'Please add PO number first' : isPartial ? 'Verify Received Items' : 'Check Items'}
                >
                  {isCompleting ? <Loader2 size={16} className="animate-spin text-emerald-500" /> : <CheckSquare size={16} className={req.poNumber ? "group-hover:scale-110 transition-transform" : ""} />}
                </button>
              )}
              
              <button 
                onClick={() => { setIsBulkDeleting(false); setRequestToDelete(req); setIsDeleteModalOpen(true); }}
                className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-all active:scale-95"
                title="Archive"
              >
                <Archive size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const handleCheckItems = (request: RequestData) => {
    if (!request.poNumber) return;
    setVerificationRequest(request);
    setIsVerificationModalOpen(true);
  };

  const handleSavePo = async (id: string) => {
    if (!isSupabaseConfigured || isSavingPo) return;
    
    setIsSavingPo(true);
    try {
      const { error } = await supabase
        .from('item_requests')
        .update({ po_number: tempPoValue.trim() || null })
        .eq('control_no', id);
      
      if (error) throw error;
      
      showSuccess('PO Updated', 'Purchase Order number saved successfully.');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, poNumber: tempPoValue.trim() || null } : r));
      setEditingPoId(null);
    } catch (err: any) {
      console.error('Failed to save PO:', err);
      showError('Error', err.message || 'Failed to save PO number');
    } finally {
      setIsSavingPo(false);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (filteredRequests.length === 0) return;
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set<string>();
      filteredRequests.forEach(req => newSelected.add(req.id));
      setSelectedIds(newSelected);
    }
  };

  const handleConfirmDelete = async () => {
    if (!isSupabaseConfigured) return;

    const archiverUsername = localStorage.getItem('aralinks_user') || 'admin';
    const now = new Date().toISOString();

    if (isBulkDeleting) {
      if (selectedIds.size === 0) return;
      setLoading(true);
      try {
        const idsArray = Array.from(selectedIds);
        
        // Separate pending and delivered requests to set appropriate status
        const pendingIds = requests.filter(r => selectedIds.has(r.id) && r.status === 'Pending').map(r => r.id);
        const deliveredIds = requests.filter(r => selectedIds.has(r.id) && (r.status === 'Delivered' || r.status === 'Partially Delivered')).map(r => r.id);

        if (pendingIds.length > 0) {
          const { error: pendingError } = await supabase
            .from('item_requests')
            .update({ 
              status: 'Deleted', 
              archived_by: archiverUsername,
              archived_at: now
            })
            .in('control_no', pendingIds);
          if (pendingError) throw pendingError;
        }

        if (deliveredIds.length > 0) {
          const { error: deliveredError } = await supabase
            .from('item_requests')
            .update({ 
              status: 'Deleted',
              archived_by: archiverUsername,
              archived_at: now
            })
            .in('control_no', deliveredIds);
          if (deliveredError) throw deliveredError;
        }
        
        showDelete('Archived', `${selectedIds.size} requisitions have been moved to vault.`);
        setSelectedIds(new Set());
        await fetchRequests(false);
        setIsDeleteModalOpen(false);
      } catch (err: any) {
        showError('Error', err.message || 'Failed to archive selected requests.');
      } finally {
        setLoading(false);
        setIsBulkDeleting(false);
      }
      return;
    }

    if (!requestToDelete) return;
    const controlNo = requestToDelete.id;
    const updateData: any = {
      status: 'Deleted',
      archived_by: archiverUsername,
      archived_at: now
    };

    setDeletingId(controlNo);
    try {
      const { error } = await supabase
        .from('item_requests')
        .update(updateData)
        .eq('control_no', controlNo);

      if (error) {
        showError('Error', error.message || 'Error removing request.');
      } else {
        showDelete('Archived', 'Requisition has been moved to vault.');
        setRequests(prev => prev.filter(r => r.id !== controlNo));
        const nextSelected = new Set(selectedIds);
        nextSelected.delete(controlNo);
        setSelectedIds(nextSelected);
        setIsDeleteModalOpen(false);
      }
    } catch (err: any) {
      console.error('Removal error:', err);
      showError('Error', err.message || 'Failed to archive requisition.');
    } finally {
      setDeletingId(null);
    }
  };

  const triggerBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    setRequestToDelete(null); 
    setIsDeleteModalOpen(true);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric' 
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const formatDeliveredDate = (dateStr: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500 relative transition-colors duration-300">
      <style>{`
        .highlight-entry-focus {
          background-color: ${isDarkMode ? '#1e293b' : '#fff9f7'} !important;
          border-left: 10px solid #FE4E02 !important;
          position: relative;
          z-index: 20;
          box-shadow: inset 0 0 0 1px rgba(254, 78, 2, 0.1), 0 10px 40px -10px rgba(254, 78, 2, 0.15) !important;
        }
      `}</style>
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative group flex-1 lg:flex-none">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-[#FE4E02] transition-colors">
              <Search size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Search Requests..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-2.5 w-full lg:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FE4E02]/20 focus:border-[#FE4E02] transition-all text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium shadow-sm text-sm"
            />
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            {(['All', 'Pending', 'Partially', 'Completed'] as StatusFilterType[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-4 py-1.5 rounded-full text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                  statusFilter === filter 
                    ? 'bg-white dark:bg-slate-700 text-[#FE4E02] shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span>{filter}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black transition-all ${
                  statusFilter === filter
                    ? 'bg-[#FE4E02] text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  {counts[filter]}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center w-full lg:w-auto gap-3">
          <button 
            onClick={() => {
              setIsMultiSelect(!isMultiSelect);
              if (isMultiSelect) setSelectedIds(new Set());
            }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 font-bold text-xs border shadow-sm ${
              isMultiSelect 
                ? 'bg-[#FE4E02] border-[#FE4E02] text-white shadow-[#FE4E02]/20' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Toggle Multi-select"
          >
            {isMultiSelect ? <CheckSquare size={16} /> : <Square size={16} />}
            <span>Select</span>
          </button>

          <button 
            disabled={!isSupabaseConfigured}
            onClick={() => {
              setEditingRequest(null);
              setIsModalOpen(true);
            }}
            className="w-full lg:w-auto bg-[#FE4E02] hover:bg-[#E04502] text-white px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg shadow-[#FE4E02]/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            {toTitleCase("New Requisition")}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[400px] md:min-h-[600px] flex flex-col mb-10 transition-colors duration-300 custom-scrollbar">
        {loading ? (
          <div className="flex-grow flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-[#FE4E02]"></div>
              <p className="text-[10px] md:text-[12px] font-bold tracking-[0.2em] text-slate-400 dark:text-slate-500 animate-pulse">{toTitleCase("Syncing Requisitions")}</p>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 py-4 min-w-[1000px] lg:min-w-full">
              {isMultiSelect && (
                <div className="w-10 flex-shrink-0 flex justify-center">
                  <button 
                    onClick={handleSelectAll}
                    className="w-5 h-5 rounded-md border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    {selectedIds.size === filteredRequests.length && filteredRequests.length > 0 ? <CheckSquare size={14} className="text-[#FE4E02]" /> : <Square size={14} className="text-slate-200 dark:text-slate-700" />}
                  </button>
                </div>
              )}
              <div className="flex-1 min-w-0 px-2 font-bold text-[10px] tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase">{toTitleCase("Req No.")}</div>
              <div 
                className="flex-1 min-w-0 px-2 font-bold text-[10px] tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              >
                {toTitleCase("Date of Request")}
                <ArrowUp size={10} className={`transition-transform duration-300 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
              </div>
              <div className="flex-1 min-w-0 px-2 font-bold text-[10px] tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase">{toTitleCase("Ticket")}</div>
              <div className="flex-1 min-w-0 px-2 font-bold text-[10px] tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase">{toTitleCase("PO")}</div>
              <div className="flex-[2] min-w-0 px-2 font-bold text-[10px] tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase">{toTitleCase("School Name")}</div>
              <div className="flex-1 min-w-0 px-2 font-bold text-[10px] tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase">{toTitleCase("Location")}</div>
              <div className="flex-1 min-w-0 px-2 font-bold text-[10px] tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase">{toTitleCase("Program")}</div>
              <div className="flex-1 min-w-0 px-2 font-bold text-[10px] tracking-wider text-slate-500 dark:text-slate-400 text-center whitespace-nowrap uppercase">{toTitleCase("Status")}</div>
              <div className="flex-1 min-w-0 px-2 font-bold text-[10px] tracking-wider text-slate-500 dark:text-slate-400 text-center whitespace-nowrap uppercase">{toTitleCase("Actions")}</div>
            </div>

            {/* Body */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRequests.map((req, i) => renderRequestRow(req, i))}
              
              {filteredRequests.length === 0 && !loading && (
                <div className="flex-grow flex flex-col items-center justify-center py-40 opacity-20">
                   <FileText size={120} strokeWidth={1} className="mb-8" />
                   <p className="text-xl font-bold tracking-[0.5em]">{toTitleCase("No Requests Found")}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <NewRequestModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingRequest(null); }} 
        onSubmit={() => fetchRequests(false)}
        initialData={editingRequest || undefined}
        isDarkMode={isDarkMode}
        prefillItem={prefillItem}
        prefillCode={prefillCode}
      />

      <RequestPreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setPreviewRequest(null); }}
        request={previewRequest}
      />

      <ItemVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => { setIsVerificationModalOpen(false); setVerificationRequest(null); }}
        request={verificationRequest}
        onConfirm={() => {
          fetchRequests(false);
        }}
        isDarkMode={isDarkMode}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setRequestToDelete(null); setIsBulkDeleting(false); }}
        onConfirm={handleConfirmDelete}
        controlNo={requestToDelete?.id || ''}
        schoolName={requestToDelete?.schoolName || ''}
        isDeleting={!!deletingId || (isBulkDeleting && loading)}
        itemCount={isBulkDeleting ? selectedIds.size : undefined}
        isDarkMode={isDarkMode}
        type="request"
      />

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 md:bottom-12 left-4 right-4 md:left-1/2 md:-translate-x-1/2 z-[80] bg-[#1a1a1a] px-6 md:px-12 py-4 md:py-6 rounded-[2rem] md:rounded-[3rem] shadow-3xl border border-white/10 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 animate-in slide-in-from-bottom-10 duration-500">
           <div className="flex flex-col items-center text-center">
              <span className="text-[9px] md:text-[10px] font-bold text-white/40 tracking-[0.25em]">{toTitleCase('Selection Queue')}</span>
              <span className="text-lg md:text-xl font-bold text-white tracking-tight">{selectedIds.size} {toTitleCase('Requests')}</span>
           </div>
           <div className="hidden md:block w-[1px] h-10 bg-white/10"></div>
           <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
              <button 
                onClick={triggerBulkDelete}
                className="flex-grow md:flex-none px-6 md:px-8 py-3 md:py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center gap-3 text-[10px] md:text-[11px] font-bold uppercase tracking-widest shadow-2xl shadow-amber-500/30 transition-all active:scale-95"
              >
                <Archive size={16} md:size={18} />
                {toTitleCase("Archive")}
              </button>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="flex-grow md:flex-none px-6 md:px-8 py-3 md:py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all"
              >
                {toTitleCase("Dismiss")}
              </button>
           </div>
        </div>
      )}

      {showScrollTop && (
        <button
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[60] w-12 h-12 bg-[#FE4E02] text-white rounded-full flex items-center justify-center shadow-3xl hover:bg-[#E04502] transition-all hover:scale-110 active:scale-90 animate-in fade-in zoom-in duration-300"
        >
          <ArrowUp size={20} strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

export default ItemsRequest;
