
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import StatusCard from './components/StatusCard';
import DriveList from './components/DriveList';
import ChargingStats from './components/ChargingStats';
import LiveMap from './components/LiveMap';
import { VehicleState, TelemetryData, OvmsConfig, DriveSession, ChargeSession } from './types';
import { fetchLatestTelemetry, fetchDrives, fetchCharges } from './services/dataService';
import { isSupabaseConfigured } from './services/supabaseClient';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [drives, setDrives] = useState<DriveSession[]>([]);
  const [charges, setCharges] = useState<ChargeSession[]>([]);
  
  // Map State
  const [selectedDrive, setSelectedDrive] = useState<DriveSession | null>(null);

  // Configuration State
  const [config, setConfig] = useState<OvmsConfig>({
    supabaseUrl: '',
    supabaseKey: '',
    vehicleId: '',
    vehicleName: '',
    serverUrl: 'huashi.sparkminds.io:18830',
    serverPassword: ''
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
       const d = await fetchDrives();
       setDrives(d);
       const c = await fetchCharges();
       setCharges(c);
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
            <DriveList drives={drives} onViewMap={handleViewDriveMap} />
          </div>
        );
      case 'charging':
        return (
          <div className="p-4 max-w-lg mx-auto">
             <ChargingStats charges={charges} />
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

            {/* 2. Database Connection */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                <span className="bg-green-500 w-2 h-6 rounded-full"></span>
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

                <button 
                  onClick={handleSaveConfig}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg mt-2 transition-colors shadow-lg"
                >
                  Save & Reload
                </button>
              </div>
            </div>
            
            <div className="text-center text-xs text-slate-500 pb-4">
              OVMS Mate v0.2.0 • BMW i3 Edition
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default App;
