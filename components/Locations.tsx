
import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Loader2, Edit3, Trash2, Plus, X, Check, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface Location {
  id: string;
  name: string;
  created_at: string;
}

interface LocationsProps {
  isDarkMode?: boolean;
}

const Locations: React.FC<LocationsProps> = ({ isDarkMode = false }) => {
  const { showSuccess, showError, showDelete } = useNotification();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLocationName, setNewLocationName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editName, setEditName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchLocations = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLocations([
        { id: '1', name: 'IT Basement', created_at: new Date().toISOString() },
        { id: '2', name: 'Areys Warehouse', created_at: new Date().toISOString() },
        { id: '3', name: 'Silang Warehouse', created_at: new Date().toISOString() }
      ]);
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) setLocations(data);
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations(true);

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('locations-master-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'locations' },
          () => fetchLocations(false)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchLocations]);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim() || !isSupabaseConfigured) return;

    const name = newLocationName.trim();
    if (locations.some(loc => loc.name.toLowerCase() === name.toLowerCase())) {
      showError('Duplicate Location', 'A location with this name already exists.');
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from('locations')
        .insert([{ name }]);

      if (error) throw error;
      
      showSuccess('Location Added', `"${name}" has been added to the master list.`);
      setNewLocationName('');
    } catch (err: any) {
      showError('Error', err.message || 'Failed to add location.');
    } finally {
      setIsAdding(true); // Keep it true for a moment to show state if needed, but actually we reset it
      setIsAdding(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!editingLocation || !editName.trim() || !isSupabaseConfigured) return;

    const name = editName.trim();
    if (locations.some(loc => loc.id !== editingLocation.id && loc.name.toLowerCase() === name.toLowerCase())) {
      showError('Duplicate Location', 'Another location with this name already exists.');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('locations')
        .update({ name })
        .eq('id', editingLocation.id);

      if (error) throw error;

      showSuccess('Location Updated', 'The location name has been changed.');
      setEditingLocation(null);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to update location.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    if (!isSupabaseConfigured) return;
    
    // Check if location is in use in item_requests
    try {
      const { data: inUse } = await supabase
        .from('item_requests')
        .select('control_no')
        .eq('location', name)
        .limit(1);

      if (inUse && inUse.length > 0) {
        showError('Cannot Delete', 'This location is currently linked to active requests.');
        return;
      }

      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showDelete('Deleted', `"${name}" has been removed.`);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to delete location.');
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500">
      <div className={`p-6 rounded-2xl border mb-8 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <form onSubmit={handleAddLocation} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Enter new location name..."
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              className={`w-full h-12 pl-12 pr-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#FE4E02]/20 focus:border-[#FE4E02] transition-all font-medium ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
              }`}
            />
          </div>
          <button 
            type="submit"
            disabled={isAdding || !newLocationName.trim()}
            className="h-12 px-8 bg-[#FE4E02] hover:bg-[#E04502] text-white rounded-xl font-bold shadow-lg shadow-[#FE4E02]/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
          >
            {isAdding ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            <span>Add Location</span>
          </button>
        </form>
      </div>

      <div className="space-y-3 mb-10">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-[#FE4E02]" size={40} />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Syncing Locations...</p>
          </div>
        ) : locations.length > 0 ? (
          locations.map((loc) => (
            <div 
              key={loc.id}
              className={`flex items-center justify-between px-6 py-4 rounded-xl border transition-all hover:shadow-md group ${
                isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/50' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={`p-2.5 rounded-lg ${isDarkMode ? 'bg-slate-800 text-[#FE4E02]' : 'bg-orange-50 text-[#FE4E02]'}`}>
                  <MapPin size={20} />
                </div>
                {editingLocation?.id === loc.id ? (
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      className={`flex-1 h-10 px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#FE4E02]/20 focus:border-[#FE4E02] ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    />
                    <button 
                      onClick={handleUpdateLocation}
                      disabled={isUpdating || !editName.trim()}
                      className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                    >
                      {isUpdating ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    </button>
                    <button 
                      onClick={() => setEditingLocation(null)}
                      className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{loc.name}</span>
                )}
              </div>

              {!editingLocation && (
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => { setEditingLocation(loc); setEditName(loc.name); }}
                    className={`p-2 rounded-lg transition-all ${
                      isDarkMode ? 'text-slate-400 hover:text-blue-400 hover:bg-blue-400/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    <Edit3 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteLocation(loc.id, loc.name)}
                    className={`p-2 rounded-lg transition-all ${
                      isDarkMode ? 'text-slate-400 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
            <MapPin size={60} strokeWidth={1} className="mb-4" />
            <p className="text-lg font-bold uppercase tracking-widest">No Locations Found</p>
            <p className="text-sm mt-1">Add your first storage location above</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Locations;

