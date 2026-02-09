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
  const [vehicleState, setVehicleState] = useState<VehicleState>(VehicleState.Parked);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [drives, setDrives] = useState<DriveSession[]>([]);
  const [charges, setCharges] = useState<ChargeSession[]>([]);
  
  // Map State
  const [selectedDrive, setSelectedDrive] = useState<DriveSession | null>(null);

  // Connection Configuration State
  const [config, setConfig] = useState<OvmsConfig>({
    supabaseUrl: '',
    supabaseKey: '',
    vehicleId: '',
    serverUrl: 'huashi.sparkminds.io:18830',
    serverPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // Initial Data Load
  useEffect(() => {
    // Load config
    const savedConfig = localStorage.getItem('ovms_config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    } else {
      // Try to populate from Env vars if local storage is empty
      // @ts-ignore
      const envUrl = import.meta.env?.VITE_SUPABASE_URL || '';
      // @ts-ignore
      const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
      if(envUrl && envKey) {
          setConfig(prev => ({...prev, supabaseUrl: envUrl, supabaseKey: envKey}));
      }
    }

    // Load initial data
    const loadData = async () => {
       const t = await fetchLatestTelemetry();
       setTelemetry(t);
       const d = await fetchDrives();
       setDrives(d);
       const c = await fetchCharges();
       setCharges(c);
    };
    loadData();

    // Polling for live data
    const interval = setInterval(async () => {
       const t = await fetchLatestTelemetry();
       setTelemetry(t);
    }, 5000); // 5s refresh

    return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem('ovms_config', JSON.stringify(config));
    alert("Settings Saved! The page will reload to apply the new database connection.");
    window.location.reload();
  };
  
  const handleViewDriveMap = (drive: DriveSession) => {
    setSelectedDrive(drive);
    setActiveTab('map');
  };

  // Generate the command for the user to run the backend
  const getLoggerCommand = () => {
    return `export OVMS_ID="${config.vehicleId}"
export OVMS_PASS="${config.serverPassword}"
export OVMS_SERVER="${config.serverUrl}"
export VITE_SUPABASE_URL="${config.supabaseUrl}"
export VITE_SUPABASE_ANON_KEY="${config.supabaseKey}"
npm run start-logger`;
  };

  // View Routing
  const renderContent = () => {
    if (!telemetry && activeTab === 'dashboard') return <div className="p-10 text-center text-slate-400">Loading Telemetry...</div>;

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="p-4 space-y-4 max-w-lg mx-auto">
             {!isSupabaseConfigured() && (
               <div className="bg-red-900/30 text-red-200 text-sm p-4 rounded-xl text-center border border-red-500/30">
                 <strong>Database Not Connected</strong><br/>
                 Please go to Settings and configure Supabase.
               </div>
             )}

            {telemetry && <StatusCard status={vehicleState} data={telemetry} />}
            
            {/* Quick Map Preview */}
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
            
            <div className="grid grid-cols-2 gap-3">
               <div className="bg-slate-800 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-3xl">🌡️</span>
                  <span className="text-sm text-slate-400 mt-2">Precondition</span>
                  <span className="text-xs text-slate-500">Off</span>
               </div>
               <div className="bg-slate-800 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-3xl">🔓</span>
                  <span className="text-sm text-slate-400 mt-2">Doors</span>
                  <span className="text-xs text-slate-500">
                     {telemetry?.locked ? 'Locked' : 'Unlocked'}
                  </span>
               </div>
            </div>
          </div>
        );
      case 'map':
        return (
          <div className="h-full w-full relative">
             {telemetry && <LiveMap telemetry={telemetry} activeDrive={selectedDrive} />}
             {selectedDrive && (
               <div className="absolute bottom-4 left-4 right-4 z-[400] bg-slate-800/90 backdrop-blur p-4 rounded-xl border border-slate-700 shadow-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white">Viewing Trip History</h4>
                      <p className="text-xs text-slate-400">
                        {new Date(selectedDrive.startDate).toLocaleDateString()} • {selectedDrive.distance} km
                      </p>
                    </div>
                    <button 
                      onClick={() => setSelectedDrive(null)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
                    >
                      Clear
                    </button>
                  </div>
               </div>
             )}
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
            
            {/* 1. Database Connection (Primary) */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                <span className="bg-green-500 w-2 h-6 rounded-full"></span>
                Database Connection
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                 Connect to your Supabase project to view vehicle data. 
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Supabase Project URL</label>
                  <input 
                    type="text" 
                    value={config.supabaseUrl}
                    onChange={(e) => setConfig({...config, supabaseUrl: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all font-mono text-sm"
                    placeholder="https://xyz.supabase.co"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-300 mb-1">Supabase Anon Key</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={config.supabaseKey}
                      onChange={(e) => setConfig({...config, supabaseKey: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all font-mono text-sm pr-12"
                      placeholder="eyJh..."
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white text-xs"
                    >
                      {showPassword ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleSaveConfig}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg mt-2 transition-colors shadow-lg shadow-green-900/20"
                >
                  Save & Connect
                </button>
              </div>
            </div>

            {/* 2. Logger Setup Helper (Secondary) */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-slate-200">
                <span className="bg-indigo-500 w-2 h-6 rounded-full"></span>
                Logger Setup Helper
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                The frontend reads from the database. To get data INTO the database, you need to run the Logger Backend. 
                Fill these out to generate the start command.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                 <div>
                    <label className="block text-xs text-slate-500 mb-1">Vehicle ID</label>
                    <input 
                      type="text" 
                      value={config.vehicleId}
                      onChange={(e) => setConfig({...config, vehicleId: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                    />
                 </div>
                 <div>
                    <label className="block text-xs text-slate-500 mb-1">MQTT Server</label>
                    <input 
                      type="text" 
                      value={config.serverUrl}
                      onChange={(e) => setConfig({...config, serverUrl: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                    />
                 </div>
                 <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">MQTT Password</label>
                    <input 
                      type="password" 
                      value={config.serverPassword}
                      onChange={(e) => setConfig({...config, serverPassword: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                    />
                 </div>
              </div>

              <div className="relative group">
                <pre className="bg-slate-950 p-4 rounded-lg text-[10px] md:text-xs font-mono text-indigo-300 overflow-x-auto whitespace-pre-wrap border border-slate-800">
                  {getLoggerCommand()}
                </pre>
                <button 
                  onClick={() => {navigator.clipboard.writeText(getLoggerCommand()); alert("Command copied!")}}
                  className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* 3. Info */}
            <div className="text-center text-xs text-slate-500 pb-4">
              OVMS Mate v0.1.0 • TeslaMate-inspired
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