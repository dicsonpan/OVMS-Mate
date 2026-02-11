
import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Layout from './components/Layout';
import StatusCard from './components/StatusCard';
import DriveList from './components/DriveList';
import ChargingStats from './components/ChargingStats';
import LiveMap from './components/LiveMap';
import { TelemetryData, OvmsConfig, DriveSession } from './types';
import { fetchLatestTelemetry } from './services/dataService';
import { isSupabaseConfigured } from './services/supabaseClient';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  
  // Map State
  const [selectedDrive, setSelectedDrive] = useState<DriveSession | null>(null);

  // Configuration State
  const [config, setConfig] = useState<OvmsConfig>({
    supabaseUrl: '',
    supabaseKey: '',
    vehicleId: '',
    vehicleName: '',
    serverUrl: 'huashi.sparkminds.io:18830',
    serverPassword: '',
    costPerKwh: 0.15, // Default
    currency: 'USD',  // Default
    geminiApiKey: ''  // Default
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem('ovms_config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    } else {
      // @ts-ignore
      const envUrl = import.meta.env?.VITE_SUPABASE_URL || '';
      // @ts-ignore
      const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
      if(envUrl && envKey) {
          setConfig(prev => ({...prev, supabaseUrl: envUrl, supabaseKey: envKey}));
      }
    }

    const loadData = async () => {
       const t = await fetchLatestTelemetry();
       setTelemetry(t);
    };
    loadData();

    const interval = setInterval(async () => {
       const t = await fetchLatestTelemetry();
       setTelemetry(t);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem('ovms_config', JSON.stringify(config));
    alert("Settings Saved! Page will reload.");
    window.location.reload();
  };
  
  const handleViewDriveMap = (drive: DriveSession) => {
    setSelectedDrive(drive);
    setActiveTab('map');
  };

  const renderContent = () => {
    if (!telemetry && activeTab === 'dashboard') return <div className="p-10 text-center text-slate-400">Loading Telemetry...</div>;

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="p-4 space-y-4 max-w-lg mx-auto">
             {!isSupabaseConfigured() && (
               <div className="bg-red-900/30 text-red-200 text-sm p-4 rounded-xl text-center border border-red-500/30">
                 <strong>Database Not Connected</strong><br/>
                 Go to Settings to configure Supabase.
               </div>
             )}

            {telemetry && <StatusCard data={telemetry} vehicleName={config.vehicleName} />}
            
            {/* Live Map Preview Block */}
            {telemetry && (
              <div 
                className="bg-slate-800 rounded-xl h-48 overflow-hidden relative border border-slate-700 shadow-md"
                onClick={() => { setSelectedDrive(null); setActiveTab('map'); }}
              >
                 <div className="absolute top-2 left-2 z-10 bg-slate-900/80 px-2 py-1 rounded text-xs font-bold text-white pointer-events-none">
                   Live Location
                 </div>
                 <LiveMap telemetry={telemetry} />
                 <div className="absolute inset-0 bg-transparent cursor-pointer z-20"></div>
              </div>
            )}
          </div>
        );
      case 'map':
        return (
          <div className="h-full w-full relative">
             {telemetry && <LiveMap telemetry={telemetry} activeDrive={selectedDrive} />}
          </div>
        );
      case 'drives':
        return (
          <div className="p-4 max-w-lg mx-auto">
            <DriveList onViewMap={handleViewDriveMap} />
          </div>
        );
      case 'charging':
        return (
          <div className="p-4 max-w-lg mx-auto">
             <ChargingStats config={config} />
          </div>
        );
      case 'settings':
        return (
          <div className="p-4 max-w-lg mx-auto space-y-8">
            <h2 className="text-2xl font-bold">Settings</h2>
            
            {/* 1. Vehicle Settings */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                <span className="bg-blue-500 w-2 h-6 rounded-full"></span>
                Vehicle Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Vehicle Name (Display)</label>
                  <input 
                    type="text" 
                    value={config.vehicleName}
                    onChange={(e) => setConfig({...config, vehicleName: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="e.g. My Silver i3"
                  />
                </div>
              </div>
            </div>

            {/* 2. Charging Cost Settings */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                <span className="bg-green-500 w-2 h-6 rounded-full"></span>
                Charging Costs
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Cost per kWh</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={config.costPerKwh}
                    onChange={(e) => setConfig({...config, costPerKwh: parseFloat(e.target.value)})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600"
                    placeholder="0.15"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Currency</label>
                  <select 
                    value={config.currency}
                    onChange={(e) => setConfig({...config, currency: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                  >
                     <option value="USD">USD ($)</option>
                     <option value="EUR">EUR (€)</option>
                     <option value="GBP">GBP (£)</option>
                     <option value="CNY">CNY (¥)</option>
                     <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Database Connection */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                <span className="bg-purple-500 w-2 h-6 rounded-full"></span>
                Database Connection
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Supabase Project URL</label>
                  <input 
                    type="text" 
                    value={config.supabaseUrl}
                    onChange={(e) => setConfig({...config, supabaseUrl: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-mono text-sm"
                    placeholder="https://xyz.supabase.co"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-300 mb-1">Supabase Anon Key</label>
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={config.supabaseKey}
                    onChange={(e) => setConfig({...config, supabaseKey: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-mono text-sm"
                    placeholder="eyJh..."
                  />
                </div>
              </div>
            </div>

            {/* 4. AI Configuration */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                <span className="bg-indigo-500 w-2 h-6 rounded-full"></span>
                AI Configuration
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Gemini API Key</label>
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={config.geminiApiKey || ''}
                    onChange={(e) => setConfig({...config, geminiApiKey: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-mono text-sm placeholder-slate-600"
                    placeholder="AIzaSy..."
                  />
                   <p className="text-xs text-slate-500 mt-2">
                    Required for "AI Insight" drive analysis. Get your key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Google AI Studio</a>.
                  </p>
                </div>
                
                {/* Button to show/hide sensitive fields (affects both Supabase & Gemini) */}
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="checkbox" 
                    id="showSecrets"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="showSecrets" className="text-sm text-slate-400 select-none cursor-pointer">Show Secrets</label>
                </div>

                <button 
                  onClick={handleSaveConfig}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg mt-6 transition-colors shadow-lg"
                >
                  Save & Reload
                </button>
              </div>
            </div>
            
            <div className="text-center text-xs text-slate-500 pb-4">
              OVMS Mate v0.2.2 • BMW i3 Edition
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </Layout>
      <Analytics />
    </>
  );
};

export default App;