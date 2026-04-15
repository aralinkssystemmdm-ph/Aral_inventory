
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, AlertCircle, Loader2, Plus, Trash2, Hash, Box, History, Calendar, User, Info } from 'lucide-react';
import { toTitleCase } from '../lib/utils';
import { RequestData } from './ItemsRequest';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface ItemVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RequestData | null;
  onConfirm: () => void;
  isDarkMode?: boolean;
}

interface DeliveryHistory {
  id: string;
  created_at: string;
  item_code: string;
  quantity: number;
  created_by: string;
  remarks?: string;
  item_name?: string;
}

const ItemVerificationModal: React.FC<ItemVerificationModalProps> = ({ 
  isOpen, 
  onClose, 
  request, 
  onConfirm,
  isDarkMode = false 
}) => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [history, setHistory] = useState<DeliveryHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (isOpen && request && isSupabaseConfigured) {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('stock_transactions')
            .select('*')
            .eq('reference_id', request.id)
            .eq('transaction_type', 'Delivery')
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          // Fetch item names for the history
          if (data && data.length > 0) {
            const itemCodes = Array.from(new Set(data.map(d => d.item_code)));
            const { data: itemsData } = await supabase
              .from('equipment')
              .select('code, name')
              .in('code', itemCodes);
            
            const historyWithNames = data.map(d => ({
              ...d,
              item_name: itemsData?.find(i => i.code === d.item_code)?.name || d.item_code
            }));
            setHistory(historyWithNames);
          } else {
            setHistory([]);
          }
        } catch (err) {
          console.error('Error fetching delivery history:', err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchHistory();
  }, [isOpen, request]);

  if (!isOpen || !request) return null;

  const handleProceed = () => {
    navigate(`/requests/${request.id}/serial-entry`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
              {request.status === 'Delivered' ? toTitleCase('Request Delivery History') : toTitleCase('Verify Received Items')}
            </h2>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 tracking-wider uppercase flex flex-wrap gap-x-4">
              <span>Control No: <span className="text-[#FE4E02]">{request.id}</span></span>
              {request.ticketNo && (
                <span>Ticket No: <span className="text-[#FE4E02]">{request.ticketNo}</span></span>
              )}
              {request.poNumber && (
                <span>PO No: <span className="text-[#0081f1]">{request.poNumber}</span></span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <History size={14} className="text-[#FE4E02]" />
              Request Delivery History
            </h3>

            {loading ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <Loader2 className="animate-spin text-[#FE4E02]" size={32} />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fetching history...</p>
              </div>
            ) : history.length > 0 ? (
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Date Received</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Item</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Qty</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Received By</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {history.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-800 dark:text-white">
                          {tx.item_name}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-black text-[#FE4E02]">
                          {tx.quantity}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {tx.created_by}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
                          {tx.remarks || 'No remarks'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <History size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">No delivery history yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className={`px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 shrink-0 ${request.status === 'Delivered' ? 'justify-center' : 'justify-between'}`}>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            {request.status === 'Delivered' ? 'Close' : 'Cancel'}
          </button>
          {request.status !== 'Delivered' && (
            <button 
              onClick={handleProceed}
              className="bg-[#FE4E02] hover:bg-[#E04502] text-white px-8 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-[#FE4E02]/20 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <CheckCircle2 size={16} />
              <span>Check Items</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default ItemVerificationModal;
