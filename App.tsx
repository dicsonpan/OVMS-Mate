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
    vehicleId: '',
    serverPassword: '',
    serverUrl: 'huashi.sparkminds.io:18830'
  });
  const [showPassword, setShowPassword] = useState(false);

  // Initial Data Load
  useEffect(() => {
    // Load config
    const savedConfig = localStorage.getItem('ovms_config');
    if (savedConfig) setConfig(JSON.parse(savedConfig));

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
    alert("Configuration Saved!");
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
# Ensure your Supabase keys are in your .env file or exported here too
npm run start-logger`;
  };

  // View Routing
  const renderContent = () => {
    if (!telemetry) return <div className="p-10 text-center">Loading...</div>;

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="p-4 space-y-4 max-w-lg mx-auto">
             {!isSupabaseConfigured() && (
               <div className="bg-blue-900/30 text-blue-200 text-xs p-2 rounded text-center border border-blue-500/30">
                 Running in Demo Mode. Connect Vercel Env Vars to Supabase for real data.
               </div>
             )}

            <StatusCard status={vehicleState} data={telemetry} />
            
            {/* Quick Map Preview */}
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
            
            <div className="grid grid-cols-2 gap-3">
               <div className="bg-slate-800 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-3xl">🌡️</span>
                  <span className="text-sm text-slate-400 mt-2">Precondition</span>
                  <span className="text-xs text-slate-500">Off</span>
               </div>
               <div className="bg-slate-800 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-3xl">🔓</span>
                  <span className="text-sm text-slate-400 mt-2">Doors</span>
                  <span className="text-xs text-slate-500">Locked</span>
               </div>
            </div>
          </div>
        );
      case 'map':
        return (
          <div className="h-full w-full relative">
             <LiveMap telemetry={telemetry} activeDrive={selectedDrive} />
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
          <div className="p-4 max-w-lg mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Settings</h2>
            
            {/* Connection Card */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="bg-indigo-600 w-2 h-6 rounded-full"></span>
                Custom Broker Configuration
              </h3>
              
              <div className="space-y-4">
                {/* Server URL */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Server URL (Host:Port)</label>
                  <input 
                    type="text" 
                    value={config.serverUrl}
                    onChange={(e) => setConfig({...config, serverUrl: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="huashi.sparkminds.io:18830"
                  />
                </div>

                {/* Vehicle ID */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vehicle ID / User</label>
                  <input 
                    type="text" 
                    value={config.vehicleId}
                    onChange={(e) => setConfig({...config, vehicleId: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Server Password */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">MQTT Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={config.serverPassword}
                      onChange={(e) => setConfig({...config, serverPassword: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 pr-10 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleSaveConfig}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg mt-2 transition-colors"
                >
                  Save Local Config
                </button>
              </div>
            </div>

            {/* OVMS Car Configuration Guide */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
               <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-400">
                <span className="text-xl">⚠️</span>
                Configure Your Car
              </h3>
              <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                Since you are using a custom broker, you must tell your OVMS module to send data to your server instead of the official one.
              </p>
              
              <div className="bg-black/40 rounded p-4 text-xs font-mono text-slate-300 space-y-2 border border-slate-700">
                <p className="text-slate-500"># SSH into your OVMS module or use Web Shell:</p>
                <p className="text-green-400">config set mqtt server {config.serverUrl.split(':')[0]}</p>
                <p className="text-green-400">config set mqtt port {config.serverUrl.split(':')[1] || '1883'}</p>
                <p className="text-green-400">config set mqtt user {config.vehicleId}</p>
                <p className="text-green-400">config set mqtt password {config.serverPassword}</p>
                <p className="text-green-400">mqtt reconnect</p>
              </div>
            </div>

            {/* Logger Command */}
            {config.vehicleId && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <span className="text-green-500">▶</span>
                  Start Data Logger
                </h3>
                <div className="relative group">
                  <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap border border-slate-800">
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
            )}
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