
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Trash2, RotateCcw, Loader2, FileText, ArrowUp, Archive, MapPin, Tag, CheckCircle2, Clock, Info, X, User, Building2, CalendarDays, AlertCircle, Eye, Zap, Layers } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import { RequestData } from './ItemsRequest';
import RequestPreviewModal from './RequestPreviewModal';
import PermanentDeleteModal from './PermanentDeleteModal';
import { useNotification } from './NotificationProvider';

interface ArchivedRequestsListProps {
  isDarkMode?: boolean;
}

const ArchivedRequestsList: React.FC<ArchivedRequestsListProps> = ({ isDarkMode = false }) => {
  const { showSuccess, showError, showDelete } = useNotification();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewRequest, setPreviewRequest] = useState<RequestData | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<any | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const userRole = localStorage.getItem('aralinks_role') || 'Staff';
  const currentUser = localStorage.getItem('aralinks_user');
  const isAdmin = userRole.toLowerCase() === 'admin';
  const [viewMode, setViewMode] = useState<'my' | 'all'>(isAdmin ? 'all' : 'my');
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchArchived = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    
    if (showLoading) setLoading(true);
    
    try {
      let query = supabase
        .from('item_requests')
        .select(`
          *,
          request_items (*)
        `)
        .not('archived_at', 'is', null);

      if (!isAdmin || viewMode === 'my') {
        query = query.eq('archived_by', currentUser);
      }

      const { data, error } = await query.order('archived_at', { ascending: false });

      if (error) {
        console.error('Error fetching archived requests:', error);
      } else if (data) {
        setRequests(data.map((req: any) => ({
          id: req.control_no,
          ticketNo: req.ticket_no,
          schoolName: req.school_name,
          location: req.location,
          requestType: req.request_type,
          date: req.date, 
          requestedBy: req.requested_by,
          archiverName: req.archived_by || 'Admin',
          status: req.status || 'Archived',
          purpose: req.purpose,
          program: req.program,
          poNumber: req.po_number,
          remarks: req.remarks,
          attachment: req.attachment,
          deliveredAt: req.delivered_at,
          created_at: req.created_at,
          archived_at: req.archived_at,
          items: (req.request_items || []).map((item: any) => ({
            id: item.id,
            qty: item.qty,
            uom: item.uom,
            item: item.item,
            code: item.code
          }))
        } as any)));
      }
    } catch (err) {
      console.error('Failed to fetch archived:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, viewMode, currentUser]);

  useEffect(() => {
    fetchArchived(true);
  }, [fetchArchived, viewMode]);

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

  const handleRestore = async (controlNo: string) => {
    if (!isSupabaseConfigured) return;
    
    const requestToRestore = requests.find(r => r.id === controlNo);
    const targetStatus = requestToRestore?.deliveredAt ? (requestToRestore.status === 'Partially Delivered' ? 'Partially Delivered' : 'Delivered') : 'Pending';

    setProcessingId(controlNo);
    try {
      const { error } = await supabase
        .from('item_requests')
        .update({ 
          status: targetStatus, 
          archived_by: null, 
          archived_at: null 
        })
        .eq('control_no', controlNo);

      if (error) throw error;
      
      showSuccess('Restored', 'Requisition has been restored to active list.');
      setRequests(prev => prev.filter(r => r.id !== controlNo));
    } catch (err: any) {
      console.error('Restore error:', err);
      showError('Error', err.message || 'Failed to restore requisition.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!isSupabaseConfigured || !requestToDelete) return;
    
    const controlNo = requestToDelete.id;
    setProcessingId(controlNo);
    try {
      const { error } = await supabase
        .from('item_requests')
        .delete()
        .eq('control_no', controlNo);

      if (error) throw error;
      
      showDelete('Permanently Deleted', 'Requisition has been removed from the database.');
      setRequests(prev => prev.filter(r => r.id !== controlNo));
      setIsDeleteModalOpen(false);
      setRequestToDelete(null);
    } catch (err: any) {
      console.error('Deletion error:', err);
      showError('Error', err.message || 'Failed to remove requisition permanently.');
      fetchArchived(false);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => 
      searchQuery.trim() === '' || 
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      req.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.archiverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.ticketNo && req.ticketNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (req.poNumber && req.poNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (req.program && req.program.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [requests, searchQuery]);

  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search archived requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-11 pr-4 py-2.5 rounded-lg text-sm font-medium border transition-all outline-none ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-white focus:ring-2 focus:ring-[#FE4E02]/20' 
                : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-[#FE4E02]/20'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">View:</span>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'my' | 'all')}
            className={`h-10 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider outline-none transition-all cursor-pointer ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-slate-300 focus:border-[#FE4E02]' 
                : 'bg-white border-slate-200 text-slate-600 focus:border-[#FE4E02]'
            }`}
          >
            <option value="my">My Records</option>
            {isAdmin && <option value="all">All Records</option>}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-grow flex flex-col items-center justify-center text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-[#FE4E02]" />
            <p className="font-bold tracking-widest uppercase text-xs">Syncing Vault...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <Archive className="text-slate-300" size={40} />
            </div>
            <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              No Archived Requests
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs text-sm font-medium">
              {searchQuery ? 'No requests match your search criteria.' : 'The request archive is currently empty.'}
            </p>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar" ref={containerRef}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredRequests.map((req) => (
                <div 
                  key={req.id}
                  className={`group relative p-6 rounded-[2rem] border-2 transition-all duration-300 cursor-pointer hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-2xl ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 hover:border-[#FE4E02]/30 hover:shadow-orange-500/10' 
                      : 'bg-white border-slate-50 hover:border-[#FE4E02]/20 hover:shadow-orange-500/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'
                      }`}>
                        <FileText size={24} />
                      </div>
                      <div>
                        <h4 className={`text-lg font-black leading-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                          {req.id}
                        </h4>
                        <p className="text-xs font-bold text-[#FE4E02] tracking-widest uppercase mt-1">
                          {req.requestType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setPreviewRequest(req);
                          setIsPreviewOpen(true);
                        }}
                        className={`p-2.5 rounded-xl transition-all ${
                          isDarkMode 
                            ? 'bg-slate-800 text-slate-400 hover:text-[#FE4E02] hover:bg-[#FE4E02]/10' 
                            : 'bg-slate-50 text-slate-400 hover:text-[#FE4E02] hover:bg-[#FE4E02]/10'
                        }`}
                        title="Preview Requisition"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleRestore(req.id)}
                        disabled={processingId === req.id}
                        className={`p-2.5 rounded-xl transition-all ${
                          isDarkMode 
                            ? 'bg-slate-800 text-slate-400 hover:text-[#FE4E02] hover:bg-[#FE4E02]/10' 
                            : 'bg-slate-50 text-slate-400 hover:text-[#FE4E02] hover:bg-[#FE4E02]/10'
                        }`}
                        title="Restore Requisition"
                      >
                        {processingId === req.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <RotateCcw size={18} />
                        )}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setRequestToDelete(req);
                            setIsDeleteModalOpen(true);
                          }}
                          className={`p-2.5 rounded-xl transition-all ${
                            isDarkMode 
                              ? 'bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-500/10' 
                              : 'bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-500/10'
                          }`}
                          title="Permanent Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Building2 size={16} className="text-slate-400 shrink-0" />
                      <p className={`text-sm font-black leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {req.schoolName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin size={16} className="text-slate-400 shrink-0" />
                      <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {req.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Zap size={16} className="text-slate-400 shrink-0" />
                      <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Program: <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{req.program || 'N/A'}</span>
                      </p>
                    </div>

                    {(req.ticketNo || req.poNumber) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {req.ticketNo && (
                          <div className="flex items-center gap-3">
                            <Tag size={16} className="text-slate-400 shrink-0" />
                            <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              Ticket: <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{req.ticketNo}</span>
                            </p>
                          </div>
                        )}
                        {req.poNumber && (
                          <div className="flex items-center gap-3">
                            <Layers size={16} className="text-slate-400 shrink-0" />
                            <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              PO: <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{req.poNumber}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-4 mt-4 border-t border-dashed border-slate-100 dark:border-slate-800 flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className="text-slate-400" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Archived: <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{formatDateTime(req.archived_at)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          By: <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                            {req.archiverName === currentUser ? 'You' : req.archiverName}
                          </span>
                          {req.archiverName === currentUser && (
                            <span className="ml-2 text-[9px] text-[#FE4E02] opacity-70">(Archived by You)</span>
                          )}
                          {req.archiverName !== currentUser && isAdmin && (
                            <span className="ml-2 text-[9px] text-slate-400 opacity-70">(Archived by Admin)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {previewRequest && (
        <RequestPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewRequest(null);
          }}
          request={previewRequest}
          isDarkMode={isDarkMode}
        />
      )}

      <PermanentDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setRequestToDelete(null);
        }}
        onConfirm={handlePermanentDelete}
        controlNo={requestToDelete?.id || ''}
        schoolName={requestToDelete?.schoolName}
        isDeleting={!!processingId}
        isDarkMode={isDarkMode}
        type="request"
      />

      {showScrollTop && (
        <button
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-10 right-10 z-[60] w-12 h-12 bg-[#FE4E02] text-white rounded-full flex items-center justify-center shadow-3xl hover:bg-[#E04502] transition-all hover:scale-110 active:scale-90 animate-in fade-in zoom-in duration-300"
        >
          <ArrowUp size={20} strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

export default ArchivedRequestsList;
