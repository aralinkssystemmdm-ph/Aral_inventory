
import React, { useState, useEffect } from 'react';
import { LayoutGrid, ClipboardList, PackageCheck, Truck, Box, Building2, MapPin, History, LogOut, Settings, Bell, Sun, Moon, FileText, ChevronDown } from 'lucide-react';
import { toTitleCase } from './lib/utils';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import SerialNumberEntryPage from './components/SerialNumberEntryPage';
import Features from './components/Features';
import ItemsRequest from './components/ItemsRequest';
import Catalog from './components/Catalog';
import Tracking from './components/Tracking';
import Inventory from './components/Inventory';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import Archived from './components/Archived';

type AuthState = 'login' | 'signup' | 'authenticated';
type ViewType = 'dashboard' | 'requests' | 'inventory' | 'catalog' | 'school' | 'location' | 'tracking' | 'archived' | 'reports' | 'setup';

interface NavItemConfig {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  children?: { id: ViewType; label: string; icon: React.ReactNode }[];
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isExpanded?: boolean;
  onClick: () => void;
  isBottom?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, isExpanded, onClick, isBottom }) => {
  // Inject bold stroke (3) for active state, standard (2) otherwise
  const iconWithStyle = React.isValidElement(icon) 
    ? React.cloneElement(icon as React.ReactElement<any>, { 
        strokeWidth: isActive ? 3 : 2,
        size: isBottom ? 20 : 22 
      }) 
    : icon;

  return (
    <div className="relative w-full px-2">
      {/* Accent Line - Only visible on active items */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-white rounded-r-full z-20" />
      )}
      
      <button 
        onClick={onClick}
        className={`
          relative flex items-center w-full h-[40px] px-3 rounded-lg transition-all duration-300 group/item
          ${isActive 
            ? 'bg-white text-[#FE4E02] shadow-sm' 
            : `text-white/70 hover:bg-white/10 hover:text-white ${isBottom ? 'opacity-60 hover:opacity-100' : ''}`
          }
        `}
      >
        <div className="shrink-0 flex items-center justify-center w-8 transition-transform duration-300 group-hover/item:scale-110">
          {iconWithStyle}
        </div>
        <span className={`
          ml-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300
          ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}
        `}>
          {label}
        </span>
      </button>
    </div>
  );
};

const NavCategory: React.FC<{ label: string; isExpanded: boolean }> = ({ label, isExpanded }) => (
  <div className={`
    px-6 mb-2 transition-all duration-300 overflow-hidden
    ${isExpanded ? 'opacity-70 mt-5 h-auto' : 'opacity-0 mt-0 h-0 pointer-events-none'}
  `}>
    <span className="text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap">
      {label}
    </span>
  </div>
);

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authState, setAuthState] = useState<AuthState>('login');
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [activeEquipmentTab, setActiveEquipmentTab] = useState<'equipment' | 'bundle'>('equipment');
  const [activeRequestStatus, setActiveRequestStatus] = useState<'All' | 'Pending' | 'Partially' | 'Completed'>('All');
  const [highlightedRequestId, setHighlightedRequestId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [fullUserName, setFullUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<{ item?: string; code?: string }>({});

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('aralinks_dark_mode') === 'true';
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }

    const savedUser = localStorage.getItem('aralinks_user');
    const savedFullName = localStorage.getItem('aralinks_fullname');
    const savedRole = localStorage.getItem('aralinks_role');
    if (savedUser) {
      setCurrentUser(savedUser);
      if (savedFullName) setFullUserName(savedFullName);
      if (savedRole) setUserRole(savedRole);
      setAuthState('authenticated');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('aralinks_dark_mode', String(newMode));
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogin = (username: string, fullName: string, role: string) => {
    setCurrentUser(username);
    setFullUserName(fullName);
    setUserRole(role);
    localStorage.setItem('aralinks_user', username);
    localStorage.setItem('aralinks_fullname', fullName);
    localStorage.setItem('aralinks_role', role);
    setAuthState('authenticated');
  };

  const handleNavigate = (viewId: string, params?: { requestId?: string; tab?: 'equipment' | 'bundle'; status?: 'All' | 'Pending' | 'Partially' | 'Completed'; prefillItem?: string; prefillCode?: string }) => {
    const v = viewId as ViewType;
    setActiveView(v);
    
    // Sync with react-router if needed, but for now we'll just use state
    // To support the new page, we might need to navigate
    if (v === 'requests') {
      navigate('/requests');
    } else if (v === 'dashboard') {
      navigate('/');
    } else {
      navigate(`/${v}`);
    }

    if (params?.requestId) {
      setHighlightedRequestId(params.requestId);
    } else {
      setHighlightedRequestId(null);
    }
    if (params?.tab) {
      setActiveEquipmentTab(params.tab);
    }
    if (params?.status) {
      setActiveRequestStatus(params.status);
    } else if (viewId === 'requests') {
      // Default to All if navigating to requests without a specific status
      setActiveRequestStatus('All');
    }

    if (params?.prefillItem || params?.prefillCode) {
      setPrefillData({ item: params.prefillItem, code: params.prefillCode });
    } else {
      setPrefillData({});
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setFullUserName(null);
    setUserRole(null);
    localStorage.removeItem('aralinks_user');
    localStorage.removeItem('aralinks_fullname');
    localStorage.removeItem('aralinks_role');
    setAuthState('login');
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  const navItems: NavItemConfig[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid size={18} /> },
    { id: 'inventory', label: 'Inventory', icon: <Box size={18} /> },
    { id: 'requests', label: 'Requests', icon: <ClipboardList size={18} /> },
    { id: 'tracking', label: 'Tracking', icon: <Truck size={18} /> },
    { id: 'catalog', label: 'Catalog', icon: <PackageCheck size={18} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={18} /> },
    { id: 'archived', label: 'Archived', icon: <History size={18} /> },
  ];

  if (authState === 'login') {
    return (
      <LoginPage 
        onLogin={handleLogin} 
        onGoToSignUp={() => setAuthState('signup')}
      />
    );
  }

  if (authState === 'signup') {
    return (
      <SignUpPage 
        onSignUpSuccess={() => setAuthState('login')} 
        onGoToLogin={() => setAuthState('login')}
      />
    );
  }

  const userInitials = (() => {
    if (!fullUserName) return '??';
    const parts = fullUserName.trim().split(' ');
    if (parts.length >= 2) {
      const firstInitial = parts[0].charAt(0);
      const lastInitial = parts[parts.length - 1].charAt(0);
      return (firstInitial + lastInitial).toUpperCase();
    }
    return fullUserName.substring(0, 2).toUpperCase();
  })();

  return (
    <div className={`h-screen w-screen flex flex-col bg-[#FAF8F8] dark:bg-slate-950 selection:bg-[#FE4E02]/10 overflow-hidden transition-colors duration-300`}>
      {/* 
        TOP NAVBAR - MATCHING DESIGN
      */}
      <nav className="w-full h-[64px] lg:h-[72px] px-4 lg:px-8 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-[100]">
        {/* Logo Section */}
        <div className="flex items-center gap-2 lg:gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-slate-600 dark:text-slate-400 hover:text-[#FE4E02] transition-colors"
          >
            <LayoutGrid size={20} />
          </button>
          <div className="w-8 h-8 lg:w-9 lg:h-9 bg-[#FE4E02] rounded-lg flex items-center justify-center shadow-sm overflow-hidden border border-white">
            <img 
              src="https://dev-true-lovers-of-god.pantheonsite.io/wp-content/uploads/2026/01/aralinksfront.png" 
              alt="Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-slate-900 dark:text-white font-bold text-lg lg:text-xl tracking-tight leading-none font-poppins">Aralinks</h2>
        </div>

        {/* Navigation Links - Pill Shape - Hidden on Mobile */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          {navItems.map((item) => (
            <div key={item.label} className="relative group/nav">
              {item.children ? (
                <div className="relative">
                  <button
                    className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                      item.children.some(child => activeView === child.id)
                        ? 'bg-white dark:bg-slate-700 text-[#FE4E02] shadow-sm' 
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {item.label}
                    <ChevronDown size={14} className="group-hover/nav:rotate-180 transition-transform duration-300" />
                  </button>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-[150] opacity-0 translate-y-2 pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-y-0 group-hover/nav:pointer-events-auto transition-all duration-300">
                    {item.children.map((child) => (
                      <button
                        key={child.id + child.label}
                        onClick={() => handleNavigate(child.id, child.label === 'Catalog' ? { tab: 'equipment' } : undefined)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          activeView === child.id && (child.id !== 'catalog' || activeEquipmentTab === 'equipment')
                            ? 'text-[#FE4E02] bg-[#FE4E02]/5' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-[#FE4E02]'
                        }`}
                      >
                        {React.cloneElement(child.icon as React.ReactElement, { size: 14 })}
                        <span className="text-xs font-bold uppercase tracking-wider">{child.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleNavigate(item.id)}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                    activeView === item.id
                      ? 'bg-white dark:bg-slate-700 text-[#FE4E02] shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="hidden sm:flex items-center gap-2 lg:gap-3">
            <button className="w-9 h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-[#FE4E02] transition-all shadow-sm">
              <Settings size={18} />
            </button>
            
            <button className="w-9 h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-[#FE4E02] transition-all shadow-sm">
              <Bell size={18} />
            </button>
          </div>

          <button 
            onClick={toggleDarkMode}
            className="w-9 h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-[#FE4E02] transition-all shadow-sm"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="flex items-center gap-2 lg:gap-3 pl-2 border-l border-slate-200 dark:border-slate-700 ml-1 lg:ml-2 relative">
            <div className="flex flex-col items-end hidden lg:flex">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{userRole}</span>
            </div>
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-9 h-9 bg-[#FE4E02] text-white rounded-lg flex items-center justify-center font-bold text-xs shadow-sm border border-white hover:scale-105 transition-transform"
            >
              {userInitials}
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-[110]" 
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-[120] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 lg:hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{userRole}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
                  >
                    <LogOut size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[150] lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-white dark:bg-slate-900 shadow-2xl z-[160] lg:hidden animate-in slide-in-from-left duration-300 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#FE4E02] rounded-lg flex items-center justify-center shadow-lg overflow-hidden border-2 border-white">
                  <img 
                    src="https://dev-true-lovers-of-god.pantheonsite.io/wp-content/uploads/2026/01/aralinksfront.png" 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h2 className="text-slate-800 dark:text-white font-black text-lg tracking-tighter leading-none font-poppins">{toTitleCase('Aralinks')}</h2>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-[#FE4E02]">
                <LogOut size={20} className="rotate-180" />
              </button>
            </div>
            <div className="flex-grow p-4 flex flex-col gap-1 overflow-y-auto">
              {navItems.map((item) => (
                <div key={item.label}>
                  {item.children ? (
                    <div className="flex flex-col gap-1">
                      <div className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                        {toTitleCase(item.label)}
                      </div>
                      {item.children.map((child) => (
                        <button
                          key={child.id + child.label}
                          onClick={() => {
                            handleNavigate(child.id, child.label === 'Catalog' ? { tab: 'equipment' } : undefined);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`flex items-center gap-4 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 ${
                            activeView === child.id && (child.id !== 'catalog' || activeEquipmentTab === 'equipment')
                              ? 'bg-[#FE4E02]/10 text-[#FE4E02]' 
                              : 'text-slate-500 dark:text-slate-400 hover:text-[#FE4E02] hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {child.icon}
                          {toTitleCase(child.label)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        handleNavigate(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${
                        activeView === item.id
                          ? 'bg-[#FE4E02] text-white shadow-lg shadow-[#FE4E02]/20' 
                          : 'text-slate-500 dark:text-slate-400 hover:text-[#FE4E02] hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {item.icon}
                      {toTitleCase(item.label)}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 bg-[#FE4E02] text-white rounded-full flex items-center justify-center font-black text-xs shadow-md border-2 border-white">
                  {userInitials}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 dark:text-white leading-none">{fullUserName}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{toTitleCase(userRole || '')}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 py-4 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-2xl font-bold uppercase tracking-widest text-xs"
              >
                <LogOut size={16} />
                {toTitleCase("Logout")}
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* 
        MAIN CONTENT
      */}
      <main className="flex-grow p-4 lg:p-8 flex flex-col h-full overflow-hidden">
        <div className="w-full flex-grow overflow-hidden min-h-0 flex flex-col">
          <Routes>
            <Route path="/" element={<Features onNavigate={handleNavigate} userName={fullUserName || 'User'} isDarkMode={isDarkMode} />} />
            <Route path="/dashboard" element={<Features onNavigate={handleNavigate} userName={fullUserName || 'User'} isDarkMode={isDarkMode} />} />
            <Route path="/requests" element={
              <ItemsRequest 
                onNavigate={handleNavigate} 
                highlightedId={highlightedRequestId || undefined} 
                initialStatus={activeRequestStatus} 
                isDarkMode={isDarkMode} 
                prefillItem={prefillData.item}
                prefillCode={prefillData.code}
              />
            } />
            <Route path="/requests/:requestId/serial-entry" element={<SerialNumberEntryPage />} />
            <Route path="/inventory" element={<Inventory onNavigate={handleNavigate} isDarkMode={isDarkMode} />} />
            <Route path="/catalog" element={<Catalog initialTab={activeEquipmentTab} isDarkMode={isDarkMode} />} />
            <Route path="/school" element={<Catalog initialTab="school" isDarkMode={isDarkMode} />} />
            <Route path="/location" element={<Catalog initialTab="location" isDarkMode={isDarkMode} />} />
            <Route path="/tracking" element={<Tracking isDarkMode={isDarkMode} />} />
            <Route path="/archived" element={<Archived isDarkMode={isDarkMode} />} />
            <Route path="/reports" element={
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-[#FE4E02]/10 rounded-full flex items-center justify-center mb-6">
                  <FileText size={40} className="text-[#FE4E02]" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Reports Module</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm">
                  The comprehensive reporting and analytics module is currently under development. 
                  Check back soon for detailed insights and data visualizations.
                </p>
              </div>
            } />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default App;
