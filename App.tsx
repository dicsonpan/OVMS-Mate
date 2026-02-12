
import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Layout from './components/Layout';
import StatusCard from './components/StatusCard';
import DriveList from './components/DriveList';
import ChargingStats from './components/ChargingStats';
import LiveMap from './components/LiveMap';
import { TelemetryData, OvmsConfig, DriveSession, ChargingLocation, TariffSegment } from './types';
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
    costPerKwh: 0.15, // Default fallback
    currency: 'CNY',
    locations: [], // Start with empty locations
    // AI Defaults
    aiProvider: 'gemini',
    geminiApiKey: '',
    openaiBaseUrl: 'https://api.siliconflow.cn/v1', 
    openaiApiKey: '',
    openaiModel: 'deepseek-ai/DeepSeek-V3' 
  });
  
  const [showPassword, setShowPassword] = useState(false);

  // Settings UI State
  const [newLocationName, setNewLocationName] = useState('');

  useEffect(() => {
    const savedConfig = localStorage.getItem('ovms_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      // Ensure locations array exists if loading old config
      if (!parsed.locations) parsed.locations = [];
      setConfig(prev => ({ ...prev, ...parsed }));
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

  // --- Location / Tariff Handlers ---

  const addLocation = () => {
    if (!newLocationName.trim()) return;
    const newLoc: ChargingLocation = {
      id: Date.now().toString(),
      name: newLocationName.trim(),
      isFlatRate: true,
      flatRate: config.costPerKwh || 0.15,
      timeSlots: []
    };
    setConfig(prev => ({
      ...prev,
      locations: [...(prev.locations || []), newLoc]
    }));
    setNewLocationName('');
  };

  const removeLocation = (id: string) => {
    setConfig(prev => ({
      ...prev,
      locations: prev.locations?.filter(l => l.id !== id)
    }));
  };

  const updateLocation = (id: string, updates: Partial<ChargingLocation>) => {
    setConfig(prev => ({
      ...prev,
      locations: prev.locations?.map(l => l.id === id ? { ...l, ...updates } : l)
    }));
  };

  const addTimeSlot = (locationId: string) => {
    const loc = config.locations?.find(l => l.id === locationId);
    if (!loc) return;
    
    const newSlot: TariffSegment = { startHour: 0, endHour: 6, rate: 0.3 };
    updateLocation(locationId, { timeSlots: [...(loc.timeSlots || []), newSlot] });
  };

  const removeTimeSlot = (locationId: string, idx: number) => {
    const loc = config.locations?.find(l => l.id === locationId);
    if (!loc || !loc.timeSlots) return;
    
    const newSlots = [...loc.timeSlots];
    newSlots.splice(idx, 1);
    updateLocation(locationId, { timeSlots: newSlots });
  };

  const updateTimeSlot = (locationId: string, idx: number, field: keyof TariffSegment, value: number) => {
    const loc = config.locations?.find(l => l.id === locationId);
    if (!loc || !loc.timeSlots) return;

    const newSlots = [...loc.timeSlots];
    newSlots[idx] = { ...newSlots[idx], [field]: value };
    updateLocation(locationId, { timeSlots: newSlots });
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

            {/* 2. Charging Cost Settings (NEW) */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
                <span className="bg-green-500 w-2 h-6 rounded-full"></span>
                Charging Tariffs
              </h3>
              
              <div className="mb-6">
                <label className="block text-sm text-slate-300 mb-1">Currency</label>
                <select 
                  value={config.currency}
                  onChange={(e) => setConfig({...config, currency: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                >
                    <option value="CNY">CNY (¥)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                </select>
              </div>

              <div className="mb-6 pb-6 border-b border-slate-700">
                 <label className="block text-sm text-slate-300 mb-1">Default Cost (Fallback)</label>
                 <div className="flex items-center gap-2">
                   <input 
                      type="number" 
                      step="0.001"
                      value={config.costPerKwh}
                      onChange={(e) => setConfig({...config, costPerKwh: parseFloat(e.target.value)})}
                      className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white w-24"
                   />
                   <span className="text-sm text-slate-500">per kWh (if no location matches)</span>
                 </div>
              </div>

              {/* Locations List */}
              <div className="space-y-4">
                 <label className="block text-sm text-slate-300 font-bold">Charging Locations</label>
                 
                 {config.locations?.map((loc) => (
                   <div key={loc.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                         <input 
                           type="text" 
                           value={loc.name}
                           onChange={(e) => updateLocation(loc.id, { name: e.target.value })}
                           className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 text-white font-bold outline-none"
                         />
                         <button onClick={() => removeLocation(loc.id)} className="text-red-400 text-xs hover:text-red-300">Remove</button>
                      </div>

                      <div className="flex items-center gap-4 mb-4 text-sm">
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              checked={loc.isFlatRate} 
                              onChange={() => updateLocation(loc.id, { isFlatRate: true })}
                              className="accent-green-500"
                            />
                            Flat Rate
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              checked={!loc.isFlatRate} 
                              onChange={() => updateLocation(loc.id, { isFlatRate: false })}
                              className="accent-blue-500"
                            />
                            Time-of-Use (Peak/Off-Peak)
                         </label>
                      </div>

                      {loc.isFlatRate ? (
                         <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              step="0.001"
                              value={loc.flatRate}
                              onChange={(e) => updateLocation(loc.id, { flatRate: parseFloat(e.target.value) })}
                              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 w-24 text-sm"
                            />
                            <span className="text-xs text-slate-500">per kWh</span>
                         </div>
                      ) : (
                         <div className="space-y-2">
                            {loc.timeSlots?.map((slot, idx) => (
                               <div key={idx} className="flex items-center gap-2 bg-slate-800/50 p-2 rounded">
                                  <div className="flex items-center gap-1">
                                     <span className="text-xs text-slate-400">Start</span>
                                     <select 
                                       value={slot.startHour} 
                                       onChange={(e) => updateTimeSlot(loc.id, idx, 'startHour', parseInt(e.target.value))}
                                       className="bg-slate-900 border border-slate-700 rounded px-1 text-xs"
                                     >
                                        {[...Array(24)].map((_, i) => <option key={i} value={i}>{i}:00</option>)}
                                     </select>
                                  </div>
                                  <span className="text-slate-500">-</span>
                                  <div className="flex items-center gap-1">
                                     <span className="text-xs text-slate-400">End</span>
                                     <select 
                                       value={slot.endHour} 
                                       onChange={(e) => updateTimeSlot(loc.id, idx, 'endHour', parseInt(e.target.value))}
                                       className="bg-slate-900 border border-slate-700 rounded px-1 text-xs"
                                     >
                                        {[...Array(24)].map((_, i) => <option key={i} value={i}>{i}:00</option>)}
                                     </select>
                                  </div>
                                  <span className="text-slate-500">@</span>
                                  <input 
                                    type="number" 
                                    step="0.001"
                                    value={slot.rate}
                                    onChange={(e) => updateTimeSlot(loc.id, idx, 'rate', parseFloat(e.target.value))}
                                    className="bg-slate-900 border border-slate-700 rounded w-16 px-1 text-xs"
                                  />
                                  <button onClick={() => removeTimeSlot(loc.id, idx)} className="ml-auto text-slate-500 hover:text-red-400">×</button>
                               </div>
                            ))}
                            <button 
                              onClick={() => addTimeSlot(loc.id)}
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2"
                            >
                              + Add Time Segment
                            </button>
                            <div className="text-[10px] text-slate-500 mt-1 italic">
                               Tip: For 22:00 to 06:00, set Start: 22, End: 6.
                            </div>
                         </div>
                      )}
                   </div>
                 ))}

                 {/* New Location Input */}
                 <div className="flex gap-2 mt-4">
                    <input 
                      type="text" 
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      placeholder="Location Name (e.g. Home)"
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white flex-1"
                    />
                    <button 
                      onClick={addLocation}
                      disabled={!newLocationName}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold"
                    >
                      Add
                    </button>
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
              
              {/* Provider Selection */}
              <div className="mb-6">
                <label className="block text-xs uppercase font-bold text-slate-500 mb-2">AI Provider</label>
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                  <button 
                    onClick={() => setConfig({...config, aiProvider: 'gemini'})}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                      config.aiProvider === 'gemini' || !config.aiProvider 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Google Gemini
                  </button>
                  <button 
                    onClick={() => setConfig({...config, aiProvider: 'openai'})}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                      config.aiProvider === 'openai' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    OpenAI / Custom
                  </button>
                </div>
              </div>

              {/* Gemini Settings */}
              {(config.aiProvider === 'gemini' || !config.aiProvider) && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
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
                      Get your key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Google AI Studio</a>.
                    </p>
                  </div>
                </div>
              )}

              {/* OpenAI / Custom Settings */}
              {config.aiProvider === 'openai' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                   <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 text-xs text-slate-400 mb-2">
                      Supports SiliconFlow (DeepSeek), OpenAI, or any OpenAI-compatible API.
                   </div>
                   
                   <div>
                     <label className="block text-sm text-slate-300 mb-1">API Base URL</label>
                     <input 
                        type="text" 
                        value={config.openaiBaseUrl || ''}
                        onChange={(e) => setConfig({...config, openaiBaseUrl: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-mono text-sm placeholder-slate-600"
                        placeholder="https://api.siliconflow.cn/v1"
                      />
                   </div>

                   <div>
                     <label className="block text-sm text-slate-300 mb-1">API Key</label>
                     <input 
                        type={showPassword ? "text" : "password"}
                        value={config.openaiApiKey || ''}
                        onChange={(e) => setConfig({...config, openaiApiKey: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-mono text-sm placeholder-slate-600"
                        placeholder="sk-..."
                      />
                   </div>

                   <div>
                     <label className="block text-sm text-slate-300 mb-1">Model Name</label>
                     <input 
                        type="text" 
                        value={config.openaiModel || ''}
                        onChange={(e) => setConfig({...config, openaiModel: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-mono text-sm placeholder-slate-600"
                        placeholder="deepseek-ai/DeepSeek-V3"
                      />
                   </div>
                </div>
              )}
              
              {/* Common Save Area */}
              <div className="pt-2">
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
              OVMS Mate v0.3.1 • BMW i3 Edition
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
