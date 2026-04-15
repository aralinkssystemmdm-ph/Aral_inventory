
import React, { useState, useEffect } from 'react';
import { Box, Layers, School, MapPin, ArrowUp, Info } from 'lucide-react';
import { toTitleCase } from '../lib/utils';
import Equipment from './Equipment';
import Schools from './Schools';
import Locations from './Locations';

import PageHeader from './PageHeader';

interface CatalogProps {
  initialTab?: 'equipment' | 'bundle' | 'school' | 'location';
  isDarkMode?: boolean;
}

const Catalog: React.FC<CatalogProps> = ({ initialTab = 'equipment', isDarkMode = false }) => {
  const [activeTab, setActiveTab] = useState<'equipment' | 'bundle' | 'school' | 'location'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'equipment':
        return <Equipment initialTab="equipment" isDarkMode={isDarkMode} />;
      case 'bundle':
        return <Equipment initialTab="bundle" isDarkMode={isDarkMode} />;
      case 'school':
        return <Schools isDarkMode={isDarkMode} />;
      case 'location':
        return <Locations isDarkMode={isDarkMode} />;
      default:
        return <Equipment initialTab="equipment" isDarkMode={isDarkMode} />;
    }
  };

  const getHeaderData = () => {
    switch (activeTab) {
      case 'equipment':
        return { title: 'Equipment', description: 'Manage standardized equipment and identifiers' };
      case 'bundle':
        return { title: 'Bundles', description: 'Configure predefined equipment packages' };
      case 'school':
        return { title: 'Schools', description: 'Manage school partners and buffer accounts' };
      case 'location':
        return { title: 'Locations', description: 'Track inventory across all physical locations' };
      default:
        return { title: 'Catalog', description: '' };
    }
  };

  const { title, description } = getHeaderData();

  const tabs = (
    <div className={`flex p-1 rounded-lg w-full lg:w-fit shadow-sm ${
      isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
    }`}>
      <button 
        onClick={() => setActiveTab('equipment')}
        className={`flex-1 lg:flex-none px-4 md:px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'equipment' ? 'bg-[#FE4E02] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
      >
        <Box size={14} /> {toTitleCase("Equipment")}
      </button>
      <button 
        onClick={() => setActiveTab('bundle')}
        className={`flex-1 lg:flex-none px-4 md:px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'bundle' ? 'bg-[#0081f1] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
      >
        <Layers size={14} /> {toTitleCase("Bundles")}
      </button>
      <button 
        onClick={() => setActiveTab('school')}
        className={`flex-1 lg:flex-none px-4 md:px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'school' ? 'bg-[#FE4E02] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
      >
        <School size={14} /> {toTitleCase("Schools")}
      </button>
      <button 
        onClick={() => setActiveTab('location')}
        className={`flex-1 lg:flex-none px-4 md:px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'location' ? 'bg-[#0081f1] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
      >
        <MapPin size={14} /> {toTitleCase("Locations")}
      </button>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <PageHeader 
        title={title}
        description={description}
        isDarkMode={isDarkMode}
        actions={tabs}
      />

      {/* Content Area */}
      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default Catalog;
