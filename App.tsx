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
    serverUrl: 'api.openvehicles.com'
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
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">OVMS Configuration</h3>
              <div className="space-y-4">
                
                {/* Vehicle ID */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vehicle ID</label>
                  <input 
                    type="text" 
                    value={config.vehicleId}
                    onChange={(e) => setConfig({...config, vehicleId: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600"
                    placeholder="e.g. DEMO123"
                  />
                </div>

                {/* Server Password */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Server Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={config.serverPassword}
                      onChange={(e) => setConfig({...config, serverPassword: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 pr-10"
                      placeholder="••••••"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Server URL */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Server URL</label>
                  <input 
                    type="text" 
                    value={config.serverUrl}
                    onChange={(e) => setConfig({...config, serverUrl: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600"
                    placeholder="api.openvehicles.com"
                  />
                </div>

                <button 
                  onClick={handleSaveConfig}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg mt-2"
                >
                  Save Local Config
                </button>
              </div>
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