
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  Settings, 
  Bell, 
  Moon, 
  Box, 
  Package, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  MapPin,
  Building2,
  FileText,
  Tag,
  Calendar
} from 'lucide-react';
import { toTitleCase } from '../lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  subWeeks, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameDay,
  isSameMonth,
  subMonths,
  subYears,
  eachYearOfInterval,
  isSameYear,
  isWithinInterval
} from 'date-fns';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'Item' | 'Request' | 'School' | 'Location';
  status?: string;
  stock?: number;
  location?: string;
  originalData: any;
}

interface FeaturesProps {
  onNavigate?: (view: string, params?: { requestId?: string; tab?: 'equipment' | 'bundle'; status?: 'All' | 'Pending' | 'Partially' | 'Completed' }) => void;
  userName?: string;
  isDarkMode?: boolean;
}

const Features: React.FC<FeaturesProps> = ({ onNavigate, userName = 'User', isDarkMode = false }) => {
  const [stats, setStats] = useState({
    pending: 0,
    partiallyDelivered: 0,
    rejected: 0,
    completed: 0,
    totalItems: 0,
    totalSchools: 0,
    completionRate: 93
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [inventoryStocks, setInventoryStocks] = useState<any[]>([]);
  const [bundleItems, setBundleItems] = useState<any[]>([]);
  const [currentBundleIndex, setCurrentBundleIndex] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'all' | 'this-week' | 'last-week' | 'months' | 'years'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<{ [key: string]: SearchResult[] }>({});
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [searchContext, setSearchContext] = useState<'filtered' | 'all-time'>('all-time');
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('aralinks_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches', e);
      }
    }
  }, []);

  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== query.toLowerCase());
      const updated = [query, ...filtered].slice(0, 5);
      localStorage.setItem('aralinks_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const removeRecentSearch = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(q => q !== query);
      localStorage.setItem('aralinks_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !isSupabaseConfigured) {
      setSearchResults({});
      setIsSearchDropdownOpen(false);
      return;
    }

    setIsSearching(true);
    setIsSearchDropdownOpen(true);

    try {
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (searchContext === 'filtered') {
        switch (timeFilter) {
          case 'this-week':
            startDate = startOfWeek(now);
            endDate = endOfWeek(now);
            break;
          case 'last-week':
            startDate = startOfWeek(subWeeks(now, 1));
            endDate = endOfWeek(subWeeks(now, 1));
            break;
          case 'months':
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            break;
          case 'years':
            startDate = startOfYear(now);
            endDate = endOfYear(now);
            break;
        }
      }

      const [itemsRes, requestsRes, schoolsRes] = await Promise.all([
        supabase.from('equipment').select('*').ilike('description', `%${query}%`).limit(5),
        supabase.from('item_requests').select('*').or(`school_name.ilike.%${query}%,control_no.ilike.%${query}%,location.ilike.%${query}%`).limit(10),
        supabase.from('schools').select('*').ilike('name', `%${query}%`).limit(5)
      ]);

      const results: { [key: string]: SearchResult[] } = {
        Items: [],
        Requests: [],
        Schools: [],
        Locations: []
      };

      if (itemsRes.data) {
        results.Items = itemsRes.data.map(item => ({
          id: item.id,
          title: item.description || item.name,
          subtitle: `Code: ${item.code}`,
          type: 'Item',
          stock: item.stock,
          originalData: item
        }));
      }

      if (requestsRes.data) {
        const filteredRequests = requestsRes.data.filter(req => {
          if (!startDate || !endDate) return true;
          const reqDate = new Date(req.created_at);
          return isWithinInterval(reqDate, { start: startDate, end: endDate });
        });

        results.Requests = filteredRequests.map(req => ({
          id: req.control_no,
          title: req.control_no,
          subtitle: `${req.school_name} - ${req.status}`,
          type: 'Request',
          status: req.status,
          originalData: req
        }));

        // Extract unique locations from requests
        const locations = Array.from(new Set(requestsRes.data.map(req => req.location))).filter(loc => loc && loc.toLowerCase().includes(query.toLowerCase()));
        results.Locations = locations.map(loc => ({
          id: loc,
          title: loc,
          subtitle: 'Inventory Location',
          type: 'Location',
          originalData: { location: loc }
        }));
      }

      if (schoolsRes.data) {
        results.Schools = schoolsRes.data.map(school => ({
          id: school.id,
          title: school.name,
          subtitle: school.address || 'School Location',
          type: 'School',
          originalData: school
        }));
      }

      // Remove empty categories
      const finalResults: { [key: string]: SearchResult[] } = {};
      Object.keys(results).forEach(key => {
        if (results[key].length > 0) {
          finalResults[key] = results[key];
        }
      });

      setSearchResults(finalResults);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [timeFilter, searchContext]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="text-brand-orange font-bold">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const handleResultClick = (result: SearchResult) => {
    saveRecentSearch(searchQuery || result.title);
    setIsSearchDropdownOpen(false);
    setSearchQuery('');
    
    if (result.type === 'Item') {
      onNavigate?.('catalog', { tab: 'equipment' });
    } else if (result.type === 'Request') {
      const status = (result.originalData.status === 'Complete' || result.originalData.status === 'Delivered') ? 'Completed' : 
                     (result.originalData.status === 'Partially Delivered') ? 'Partially' : 'Pending';
      onNavigate?.('requests', { requestId: result.id, status });
    } else if (result.type === 'School') {
      onNavigate?.('school');
    } else if (result.type === 'Location') {
      onNavigate?.('location');
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
    try {
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let interval: Date[] = [];
      let groupingFormat: string = 'MMM';

      switch (timeFilter) {
        case 'all':
          startDate = null;
          endDate = null;
          // For "All" chart view, show months of the current year for better detail
          const currentYearStart = startOfYear(now);
          const currentYearEnd = endOfYear(now);
          interval = eachMonthOfInterval({ start: currentYearStart, end: currentYearEnd });
          groupingFormat = 'MMM';
          break;
        case 'this-week':
          startDate = startOfWeek(now);
          endDate = endOfWeek(now);
          interval = eachDayOfInterval({ start: startDate, end: endDate });
          groupingFormat = 'EEE'; // Mon, Tue...
          break;
        case 'last-week':
          const lastWeek = subWeeks(now, 1);
          startDate = startOfWeek(lastWeek);
          endDate = endOfWeek(lastWeek);
          interval = eachDayOfInterval({ start: startDate, end: endDate });
          groupingFormat = 'EEE';
          break;
        case 'months':
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          interval = eachMonthOfInterval({ start: startDate, end: endDate });
          groupingFormat = 'MMM'; // Jan, Feb...
          break;
        case 'years':
          startDate = subYears(now, 4);
          endDate = now;
          interval = eachYearOfInterval({ start: startDate, end: endDate });
          groupingFormat = 'yyyy';
          break;
        default:
          startDate = startOfWeek(now);
          endDate = endOfWeek(now);
          interval = eachDayOfInterval({ start: startDate, end: endDate });
          groupingFormat = 'EEE';
      }

      // Fetch counts and data
      const getFilteredQuery = (status: string | string[] | null = null, orderBy: string = 'created_at', isCountOnly: boolean = false) => {
        let query = supabase.from('item_requests').select('*', { count: isCountOnly ? 'exact' : undefined, head: isCountOnly });
        
        if (status) {
          if (Array.isArray(status)) {
            query = query.in('status', status);
          } else {
            query = query.eq('status', status);
          }
          
          if (status !== 'Rejected') {
            query = query.is('archived_at', null);
          }
        }

        if (timeFilter !== 'all' && startDate && endDate) {
          const filterField = orderBy === 'delivered_at' ? 'delivered_at' : 'created_at';
          query = query.gte(filterField, startDate.toISOString()).lte(filterField, endDate.toISOString());
        }

        if (!isCountOnly) {
          query = query.order(orderBy, { ascending: false }).limit(5);
        }

        return query;
      };
      
      const [
        pendingRes,
        partiallyDeliveredRes,
        rejectedRes,
        completedRes,
        itemsRes,
        schoolsRes,
        recentCreatedRes,
        recentCompletedRes,
        stocksRes,
        bundlesRes,
        chartRequestsRes
      ] = await Promise.all([
        getFilteredQuery('Pending', 'created_at', true),
        getFilteredQuery('Partially Delivered', 'created_at', true),
        getFilteredQuery('Rejected', 'created_at', true),
        getFilteredQuery(['Complete', 'Delivered'], 'created_at', true),
        supabase.from('equipment').select('*', { count: 'exact', head: true }),
        supabase.from('schools').select('*', { count: 'exact', head: true }),
        getFilteredQuery(null, 'created_at', false),
        getFilteredQuery(['Complete', 'Delivered', 'Partially Delivered'], 'delivered_at', false),
        supabase.from('equipment').select('*').limit(6),
        supabase.from('bundle_items').select('*').order('description', { ascending: true }),
        timeFilter === 'all' 
          ? supabase.from('item_requests').select('created_at')
          : supabase.from('item_requests').select('created_at').gte('created_at', startDate!.toISOString()).lte('created_at', endDate!.toISOString())
      ]);

      const pending = pendingRes.count || 0;
      const partiallyDelivered = partiallyDeliveredRes.count || 0;
      const rejected = rejectedRes.count || 0;
      const completed = completedRes.count || 0;
      const totalRelevant = pending + partiallyDelivered + completed;
      const rate = totalRelevant > 0 ? Math.round((completed / totalRelevant) * 100) : 0;

      setStats({
        pending,
        partiallyDelivered,
        rejected,
        completed,
        totalItems: itemsRes.count || 0,
        totalSchools: schoolsRes.count || 0,
        completionRate: totalRelevant > 0 ? rate : 0
      });

      const createdActivities = (recentCreatedRes.data || []).map(req => ({
        id: `created-${req.control_no}`,
        requestId: req.control_no,
        text: `${req.school_name || 'A school'} requested an item.`,
        time: new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(req.created_at).getTime(),
        type: 'created',
        status: (req.status === 'Complete' || req.status === 'Delivered') ? 'Completed' : 
                (req.status === 'Partially Delivered') ? 'Partially' : 'Pending'
      }));

      const completedActivities = (recentCompletedRes.data || []).map(req => ({
        id: `completed-${req.control_no}`,
        requestId: req.control_no,
        text: `${req.school_name || 'A school'} marked a request as ${req.status === 'Partially Delivered' ? 'partially delivered' : 'delivered'}.`,
        time: new Date(req.delivered_at || req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(req.delivered_at || req.created_at).getTime(),
        type: 'completed',
        status: req.status === 'Partially Delivered' ? 'Partially' : 'Completed'
      }));

      const allActivities = [...createdActivities, ...completedActivities]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 8);

      setRecentActivities(allActivities);

      if (stocksRes.data) {
        setInventoryStocks(stocksRes.data.map(item => ({
          name: item.description || item.name || 'Unknown Item',
          code: item.code || 'INV0000000'
        })));
      }

      if (bundlesRes.data) {
        setBundleItems(bundlesRes.data);
      }

      // Process chart data
      const requests = chartRequestsRes.data || [];
      const processedChartData = interval.map(date => {
        const count = requests.filter(req => {
          const reqDate = new Date(req.created_at);
          if (timeFilter === 'months' || timeFilter === 'all') return isSameMonth(reqDate, date);
          if (timeFilter === 'years') return isSameYear(reqDate, date);
          return isSameDay(reqDate, date);
        }).length;
        return {
          name: format(date, groupingFormat),
          value: count
        };
      });

      setChartData(processedChartData);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeFilter]);

  const yAxisMax = useMemo(() => {
    const maxValue = Math.max(...chartData.map(d => d.value), 0);
    if (maxValue <= 100) return 100;
    if (maxValue <= 500) return 500;
    if (maxValue <= 1000) return 1000;
    return Math.ceil(maxValue / 500) * 500; // For values > 1000, use 500-unit steps
  }, [chartData]);

  const yAxisTicks = useMemo(() => {
    const step = yAxisMax / 5;
    return [0, step, step * 2, step * 3, step * 4, yAxisMax];
  }, [yAxisMax]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleNextBundle = () => {
    if (bundleItems.length === 0) return;
    setCurrentBundleIndex((prev) => (prev + 1) % bundleItems.length);
  };

  const handlePrevBundle = () => {
    if (bundleItems.length === 0) return;
    setCurrentBundleIndex((prev) => (prev - 1 + bundleItems.length) % bundleItems.length);
  };

  const currentBundle = bundleItems[currentBundleIndex] || {
    description: 'Starter Bundle',
    bundle: 'Basic Electronics Kit',
    code: 'INV0000700'
  };

  const totalRequests = stats.completed + stats.partiallyDelivered + stats.pending;
  const pieData = totalRequests > 0 ? [
    { name: 'Delivered', value: Math.round((stats.completed / totalRequests) * 100) },
    { name: 'Partially Delivered', value: Math.round((stats.partiallyDelivered / totalRequests) * 100) },
    { name: 'Pending', value: Math.round((stats.pending / totalRequests) * 100) },
  ] : [
    { name: 'Delivered', value: 0 },
    { name: 'Partially Delivered', value: 0 },
    { name: 'Pending', value: 100 },
  ];
  const COLORS = ['#FF5C00', '#F59E0B', isDarkMode ? '#1e293b' : '#F3F4F6'];

  return (
    <div className="w-full h-full overflow-y-auto bg-brand-offwhite dark:bg-slate-950 p-3 md:p-4 font-sans transition-colors duration-300">
      {/* Top Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-2 md:mb-4 gap-6">
        <div className="flex-grow">
          <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white mb-2">
            {toTitleCase('Welcome In,')} <span className="text-brand-orange">{userName.split(' ')[0]}</span>
          </h1>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4">
            <div className="flex items-center gap-2" ref={filterRef}>
              <div className="relative">
                <div 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="relative flex items-center justify-between gap-2 bg-black text-white px-4 py-2 rounded-full hover:bg-slate-800 transition-colors cursor-pointer group text-sm min-w-[120px]"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="text-white shrink-0 w-4 h-4" />
                    <span className="font-medium">
                      {timeFilter === 'all' ? toTitleCase('Filter') :
                       timeFilter === 'this-week' ? toTitleCase('This Week') :
                       timeFilter === 'last-week' ? toTitleCase('Last Week') :
                       timeFilter === 'months' ? toTitleCase('Months') :
                       toTitleCase('Years')}
                    </span>
                  </div>
                  <ChevronDown className={`text-white transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} size={14} />
                </div>

                {isFilterOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-900 text-black dark:text-white rounded-lg shadow-lg z-50 overflow-hidden border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
                    {[
                      { value: 'all', label: 'Filter' },
                      { value: 'this-week', label: 'This Week' },
                      { value: 'last-week', label: 'Last Week' },
                      { value: 'months', label: 'Months' },
                      { value: 'years', label: 'Years' }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => {
                          setTimeFilter(option.value as any);
                          setIsFilterOpen(false);
                        }}
                        className={`px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${
                          timeFilter === option.value 
                            ? 'bg-orange-100 text-orange-500 dark:bg-brand-orange/10' 
                            : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {toTitleCase(option.label)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="relative w-full sm:flex-grow sm:max-w-md" ref={searchRef}>
              <div className="relative group flex items-center">
                <div className="absolute left-4 inset-y-0 flex items-center justify-center pointer-events-none z-10">
                  {isSearching ? (
                    <div className="w-4 h-4 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Search className="text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-brand-orange" size={18} />
                  )}
                </div>
                <input 
                  type="text" 
                  placeholder="Search items, requests, schools..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 text-sm transition-all shadow-sm group-focus-within:shadow-md"
                />
              </div>

              {/* Search Results Dropdown */}
              {isSearchDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Recent Searches */}
                  {!searchQuery.trim() && recentSearches.length > 0 && (
                    <div className="p-2 border-b border-slate-50 dark:border-slate-800">
                      <div className="px-3 py-2 flex items-center gap-2">
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                          Recent Searches
                        </span>
                      </div>
                      <div className="space-y-1">
                        {recentSearches.map((query, i) => (
                          <button
                            key={`recent-${i}`}
                            onClick={() => {
                              setSearchQuery(query);
                              handleSearch(query);
                            }}
                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left group"
                          >
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-brand-orange transition-colors">
                              {query}
                            </span>
                            <div className="flex items-center gap-2">
                              <div
                                onClick={(e) => removeRecentSearch(e, query)}
                                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                title="Remove from history"
                              >
                                <X size={14} />
                              </div>
                              <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-orange transition-all" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search Results */}
                  {Object.keys(searchResults).length > 0 ? (
                    (Object.entries(searchResults) as [string, SearchResult[]][]).map(([category, items]) => (
                      <div key={category} className="p-2">
                        <div className="px-3 py-2 flex items-center gap-2">
                          {category === 'Items' && <Box size={14} className="text-brand-orange" />}
                          {category === 'Requests' && <FileText size={14} className="text-brand-orange" />}
                          {category === 'Schools' && <Building2 size={14} className="text-brand-orange" />}
                          {category === 'Locations' && <MapPin size={14} className="text-brand-orange" />}
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            {toTitleCase(category)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {items.map((result, i) => (
                            <button
                              key={`${result.id}-${i}`}
                              onClick={() => handleResultClick(result)}
                              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left group"
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-brand-orange transition-colors">
                                  {highlightMatch(result.title, searchQuery)}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                  {result.subtitle}
                                </span>
                              </div>
                              <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-orange group-hover:translate-x-1 transition-all" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : searchQuery.trim() && !isSearching ? (
                    <div className="p-8 text-center">
                      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Search size={24} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{toTitleCase('No results found')}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {toTitleCase('Try searching for something else or switch to')} <button onClick={() => setSearchContext('all-time')} className="text-brand-orange hover:underline">{toTitleCase('All Time')}</button>
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center lg:justify-end">
          <div className="flex items-center gap-6 sm:gap-12">
            <div className="text-center hover:scale-110 transition-transform duration-300 cursor-default">
              <div className="text-3xl sm:text-5xl font-black text-brand-orange leading-none">{stats.pending}</div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{toTitleCase('Pendings')}</div>
            </div>
            <div className="text-center hover:scale-110 transition-transform duration-300 cursor-default">
              <div className="text-3xl sm:text-5xl font-black text-brand-orange leading-none">{stats.totalItems}</div>
              <div 
                onClick={() => onNavigate?.('catalog')}
                className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 cursor-pointer hover:text-brand-orange"
              >
                {toTitleCase('Catalog')}
              </div>
            </div>
            <div className="text-center hover:scale-110 transition-transform duration-300 cursor-default">
              <div className="text-3xl sm:text-5xl font-black text-brand-orange leading-none">{stats.totalSchools}</div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{toTitleCase('Schools')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-12 gap-3 md:gap-4 mb-4 md:mb-6">
        {/* Left: Aralinks Inventory Banner */}
        <div className="col-span-12 lg:col-span-4 h-[240px] md:h-[320px] bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 flex flex-col justify-end text-white shadow-lg shadow-orange-600/20 relative overflow-hidden hover:scale-[1.02] transition-transform duration-300 cursor-default">
          <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-white/10 rounded-full -mr-16 md:-mr-20 -mt-16 md:-mt-20 blur-3xl"></div>
          <div className="relative z-10">
            <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-none mb-1">{toTitleCase('Aralinks')}</h2>
            <p className="text-lg md:text-xl font-medium opacity-90">{toTitleCase('Inventory')}</p>
          </div>
        </div>

        {/* Middle: Request Status */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 h-[280px] md:h-[320px] bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col hover:scale-[1.02] transition-transform duration-300 cursor-default">
          <h3 className="text-base md:text-lg font-black text-slate-800 dark:text-white mb-6 md:mb-8 font-poppins">{toTitleCase('Request Status')}</h3>
          <div className="space-y-3 md:space-y-4 flex-grow">
            <div 
              onClick={() => onNavigate?.('requests', { status: 'Pending' })}
              className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 -m-2 rounded-xl transition-colors group"
            >
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-brand-orange">{toTitleCase('Pending')}</span>
              <span className="text-xl md:text-2xl font-black text-slate-800 dark:text-white group-hover:text-brand-orange">{stats.pending}</span>
            </div>
            <div 
              onClick={() => onNavigate?.('requests', { status: 'Partially' })}
              className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 -m-2 rounded-xl transition-colors group"
            >
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-brand-orange">{toTitleCase('Partially Delivered')}</span>
              <span className="text-xl md:text-2xl font-black text-slate-800 dark:text-white group-hover:text-brand-orange">{stats.partiallyDelivered}</span>
            </div>
            <div 
              onClick={() => onNavigate?.('archived')}
              className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 -m-2 rounded-xl transition-colors group"
            >
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-brand-orange">{toTitleCase('Rejected')}</span>
              <span className="text-xl md:text-2xl font-black text-slate-800 dark:text-white group-hover:text-brand-orange">{stats.rejected}</span>
            </div>
            <div 
              onClick={() => onNavigate?.('requests', { status: 'Completed' })}
              className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 -m-2 rounded-xl transition-colors group"
            >
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-brand-orange">{toTitleCase('Delivered')}</span>
              <span className="text-xl md:text-2xl font-black text-slate-800 dark:text-white group-hover:text-brand-orange">{stats.completed}</span>
            </div>
          </div>
        </div>

        {/* Right: Completion Rate */}
        <div className="col-span-12 md:col-span-6 lg:col-span-2 h-[280px] md:h-[320px] bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-300 cursor-default">
          <h3 className="text-[10px] md:text-[11px] font-black text-slate-800 dark:text-white mb-4 md:mb-6 font-poppins">{toTitleCase('Request Completion Rate')}</h3>
          <div className="relative w-full aspect-square flex items-center justify-center max-w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <linearGradient id="pieGradient0" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FE4E02" />
                    <stop offset="100%" stopColor="#FF8A00" />
                  </linearGradient>
                  <linearGradient id="pieGradient1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#FBCC14" />
                  </linearGradient>
                </defs>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="50%"
                  outerRadius="85%"
                  paddingAngle={0}
                  dataKey="value"
                  startAngle={90}
                  endAngle={450}
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? "url(#pieGradient0)" : index === 1 ? "url(#pieGradient1)" : COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  itemStyle={{ color: '#1e293b' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Far Right: Recent Activities - Tall Sidebar */}
        <div className="col-span-12 lg:col-span-3 lg:row-span-2 bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col hover:scale-[1.01] transition-transform duration-300 cursor-default min-h-[400px] lg:min-h-[600px] mt-2 lg:mt-0">
          <h3 className="text-xs md:text-sm font-black text-slate-800 dark:text-white mb-6 md:mb-8 font-poppins">{toTitleCase('Recent Activities')}</h3>
          <div className="space-y-4 flex-grow overflow-y-auto pr-2 max-h-[400px] lg:max-h-none">
            {recentActivities.map((activity) => (
              <div 
                key={activity.id} 
                className="flex gap-3 p-3 -m-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
                onClick={() => {
                  const status = activity.status === 'Delivered' ? 'Completed' : 
                                 activity.status === 'Partially Delivered' ? 'Partially' : 
                                 'Pending';
                  onNavigate?.('requests', { requestId: activity.requestId, status });
                }}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${activity.type === 'completed' ? 'bg-emerald-500' : 'bg-brand-orange'}`}></div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {activity.text}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{activity.time}</span>
                </div>
              </div>
            ))}
            {recentActivities.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-10">No recent activities</p>
            )}
          </div>
          <button 
            onClick={() => onNavigate?.('requests')}
            className="w-full mt-6 py-3 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors shrink-0"
          >
            {toTitleCase('View all activity')}
          </button>
        </div>

        {/* Requests Chart Section - Wide Card */}
        <div className="col-span-12 lg:col-span-9 bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:scale-[1.01] transition-transform duration-300 cursor-default mt-2 lg:mt-0">
          <h3 className="text-base md:text-lg font-black text-slate-800 dark:text-white mb-4 md:mb-6 font-poppins">{toTitleCase('Requests')}</h3>
          <div className="h-[250px] md:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF5C00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF5C00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false} 
                  stroke={isDarkMode ? "#334155" : "#F1F5F9"} 
                />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: isDarkMode ? '#64748b' : '#94A3B8', fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  domain={[0, yAxisMax]}
                  ticks={yAxisTicks}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: isDarkMode ? '#64748b' : '#94A3B8', fontWeight: 600 }}
                  width={50}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className={`p-3 rounded-xl shadow-xl border-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`}>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                          <p className="text-sm font-black">
                            <span className="text-brand-orange">{payload[0].value}</span> {payload[0].value === 1 ? 'request' : 'requests'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#FF5C00" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row: Catalog Stocks & Bundle Items */}
      <div className="grid grid-cols-12 gap-3 md:gap-4 mt-4 md:mt-6">
        {/* Catalog Stocks */}
        <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 mb-6 md:mb-8">
            <h3 className="text-lg md:text-2xl font-black text-slate-800 dark:text-white">{toTitleCase('Catalog')} <span className="text-brand-orange">{toTitleCase('Stocks')}</span></h3>
            <div className="flex-grow h-[1px] bg-brand-orange/20"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-12 gap-y-4 md:gap-y-6 mb-8 md:mb-10">
            <div className="hidden sm:flex justify-between text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 pb-2">
              <span>{toTitleCase('Product Name')}</span>
              <span>{toTitleCase('Item Code')}</span>
            </div>
            <div className="hidden sm:block"></div>
            
            {inventoryStocks.map((item) => (
              <React.Fragment key={item.code}>
                <div 
                  onClick={() => onNavigate?.('catalog', { tab: 'equipment' })}
                  className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-3 -m-3 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 border-2 border-brand-orange rounded-sm group-hover:bg-brand-orange transition-colors"></div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-brand-orange transition-colors truncate max-w-[150px] sm:max-w-none">{item.name}</span>
                  </div>
                  <span className="text-[10px] md:text-xs font-medium text-slate-400 dark:text-slate-500 font-mono">{item.code}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <button 
            onClick={() => onNavigate?.('catalog')}
            className="w-full py-3 md:py-4 bg-brand-orange text-white rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors shadow-lg shadow-brand-orange/20"
          >
            {toTitleCase('View all items')}
          </button>
        </div>

        {/* Catalog Items */}
        <div className="col-span-12 lg:col-span-4 flex flex-col items-center">
          <h3 className="text-lg md:text-2xl font-black text-slate-800 dark:text-white mb-6 md:mb-8 self-start">{toTitleCase('Catalog Bundle')}</h3>
          <div className="relative w-full flex items-center justify-center gap-2 md:gap-4">
            <button 
              onClick={handlePrevBundle}
              className="w-8 h-8 md:w-10 md:h-10 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10 shrink-0"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div 
              onClick={() => onNavigate?.('catalog', { tab: 'bundle' })}
              className="flex-grow bg-[#E5D5C9] dark:bg-slate-800 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 flex flex-col items-center text-center shadow-sm relative overflow-hidden h-[280px] md:h-[320px] justify-center cursor-pointer hover:scale-[1.02] transition-transform group"
            >
              <div className="w-24 h-24 md:w-32 md:h-32 mb-4 md:mb-6 relative z-10 group-hover:scale-110 transition-transform">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl"></div>
                <Package size={96} className="text-slate-800 dark:text-brand-orange relative z-10 mx-auto" strokeWidth={1} />
              </div>
              <h4 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white mb-2 group-hover:text-brand-orange transition-colors line-clamp-1">
                {currentBundle.description || currentBundle.bundle}
              </h4>
              <p className="text-[10px] md:text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 line-clamp-1">
                {currentBundle.bundle || 'Bundle Item'}
              </p>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 font-mono">
                {currentBundle.code}
              </p>
            </div>

            <button 
              onClick={handleNextBundle}
              className="w-8 h-8 md:w-10 md:h-10 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10 shrink-0"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Features;
