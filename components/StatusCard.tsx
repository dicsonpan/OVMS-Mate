
import React from 'react';
import { VehicleState, TelemetryData } from '../types';

interface StatusCardProps {
  data: TelemetryData;
  vehicleName?: string;
}

// TeslaMate-style duration format: HH:MM
const formatDuration = (seconds: number) => {
  if (!seconds && seconds !== 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
};

const StatusCard: React.FC<StatusCardProps> = ({ data, vehicleName }) => {
  if (!data) return null;

  // 1. Driving State Logic
  let state = VehicleState.Parked;
  let stateDuration = data.parkTime;
  
  if (data.lastUpdateAge > 10) {
    state = VehicleState.Asleep;
  } else if (data.driveTime > 1 || data.speed > 0) {
    state = VehicleState.Driving;
    stateDuration = data.driveTime;
  }

  // 2. Charging Logic
  const isCharging = (data.chargePilotA || 0) > 0 && data.chargePlugStatus === 'Connected';
  const isCharged = (data.chargePilotA || 0) === 0 && data.soc === 100;

  // 3. Status Badges
  const doorStatuses = [
    { label: 'Locked', val: data.locked, icon: data.locked ? '🔒' : '🔓', color: data.locked ? 'bg-slate-700' : 'bg-red-500 animate-pulse' },
    { label: 'Charge Port', val: data.doorChargePort, icon: '🔌' },
    { label: 'Door FL', val: data.doorFL, icon: '🚪' },
    { label: 'Door FR', val: data.doorFR, icon: '🚪' },
    { label: 'Door RL', val: data.doorRL, icon: '🚪' },
    { label: 'Door RR', val: data.doorRR, icon: '🚪' },
    { label: 'Hood', val: data.doorHood, icon: '🚘' },
    { label: 'Trunk', val: data.doorTrunk, icon: '📦' },
  ].filter(s => s.val !== undefined && (s.label === 'Locked' || s.val === true));

  // 4. Trip Calculations
  // Calculate Avg Speed based on Trip Distance / Trip Duration (converted to hours)
  const tripDurationHours = data.driveTime / 3600;
  const avgSpeed = tripDurationHours > 0.01 ? (data.tripDistance / tripDurationHours) : data.speed;

  return (
    <div className="space-y-4">
      {/* MAIN CARD: Vehicle Name, Status, SOC, Odometer, Range */}
      <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {vehicleName || data.vehicleId || 'My BMW i3'}
          </h2>
          <div className="flex gap-1">
            {doorStatuses.map((s, i) => (
              <div key={i} className={`px-2 py-1 rounded-md text-[10px] flex items-center gap-1 border border-slate-600 ${s.color || 'bg-slate-900/50'}`}>
                <span>{s.icon}</span>
                <span className="font-bold text-slate-300 uppercase">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* DRIVE STATE & DURATION */}
        <div className="flex items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
          <div className={`w-3 h-3 rounded-full ${
            state === VehicleState.Driving ? 'bg-blue-500 animate-pulse' : 
            state === VehicleState.Asleep ? 'bg-purple-600' : 'bg-green-500'
          }`}></div>
          <span className="font-bold text-sm tracking-widest uppercase">{state}</span>
          <span className="text-slate-500 text-xs">for {formatDuration(stateDuration)}</span>
          {data.gear && <span className="ml-auto bg-slate-700 text-white font-mono font-bold px-2 py-0.5 rounded text-xs">{data.gear}</span>}
        </div>

        {/* SOC, ODOMETER, RANGE */}
        <div className="flex justify-between items-end mt-6">
          <div className="flex items-baseline gap-2">
            <span className={`text-6xl font-black ${data.soc < 20 ? 'text-red-500' : 'text-green-400'}`}>
              {Math.round(data.soc)}
            </span>
            <span className="text-2xl font-bold text-slate-500">%</span>
          </div>
          
          <div className="flex flex-col items-center pb-2 px-2">
             <div className="text-xl font-bold text-white tracking-wide">{Math.round(data.odometer || 0).toLocaleString()} <span className="text-xs text-slate-500 font-normal">km</span></div>
             <div className="text-[8px] text-slate-500 uppercase font-bold tracking-widest">Odometer</div>
          </div>

          <div className="text-right">
            <div className="text-4xl font-bold text-white">
              {Math.round(data.rangeEst || 0)} <span className="text-lg text-slate-500">km</span>
            </div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Estimated Range</div>
          </div>
        </div>
      </div>

      {/* COMPACT METRICS DASHBOARD (Single Row) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Power</div>
          <div className="text-lg font-mono font-bold">{(data.power || 0).toFixed(1)} <span className="text-xs">kW</span></div>
        </div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Consumption</div>
          <div className="text-lg font-mono font-bold">{Math.round(data.consumptionInst || 0)} <span className="text-xs">Wh/km</span></div>
        </div>
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Speed</div>
          <div className="text-lg font-mono font-bold">{Math.round(data.speed || 0)} <span className="text-xs">km/h</span></div>
        </div>
      </div>

      {/* TEMPERATURE & VENTILATION */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-black text-slate-500 uppercase">Climate & Temps</h3>
          <div className="flex gap-2">
            {data.acStatus && <span className="text-[9px] bg-blue-900/50 text-blue-300 px-1.5 rounded">AC ON</span>}
            {data.ventMode && <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 rounded">{data.ventMode}</span>}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {[
            { label: 'Ambient', val: data.tempAmbient, icon: '🌍' },
            { label: 'Cabin', val: data.insideTemp, icon: '🛋️' },
            { label: 'Battery', val: data.tempBattery, icon: '🔋' },
            { label: 'Motor', val: data.tempMotor, icon: '⚙️' },
            { label: 'Charger', val: data.chargerTemp, icon: '🔌' },
          ].map((t, i) => (
            <div key={i} className="text-center p-1 bg-slate-900/30 rounded-lg">
              <div className="text-[14px]">{t.icon}</div>
              <div className="text-[10px] text-white font-bold">{Math.round(t.val || 0)}°</div>
              <div className="text-[7px] text-slate-500 uppercase">{t.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* BATTERY & ELECTRICAL */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-black text-slate-500 uppercase">Battery & Charging</h3>
          {isCharging && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">CHARGING</span>}
          {isCharged && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">CHARGED</span>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">SoH</span>
              <span className="text-green-400 font-bold">{data.soh}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Voltage</span>
              <span className="font-mono">{(data.voltage || 0).toFixed(1)}V</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Current</span>
              <span className="font-mono">{(data.current || 0).toFixed(1)}A</span>
            </div>
          </div>
          <div className="space-y-2 border-l border-slate-700 pl-4">
            <div className="flex justify-between text-xs font-bold text-blue-300">
              <span className="text-slate-500 font-normal">12V Battery</span>
              <span>{(data.voltage12v || 0).toFixed(1)}V</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">12V Current</span>
              <span className="font-mono">{(data.current12v || 0).toFixed(1)}A</span>
            </div>
          </div>
        </div>
      </div>

      {/* CURRENT TRIP INFO - TESLAMATE STYLE */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 shadow-lg">
        <h3 className="text-xs font-black text-slate-500 uppercase mb-4 flex items-center gap-2">
          <span className="w-1.5 h-3 bg-blue-500 rounded-full"></span> Current Trip Info
        </h3>
        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
           {/* Duration */}
           <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Duration</span>
              <span className="text-2xl font-mono text-white">{formatDuration(data.driveTime)} <span className="text-xs font-sans text-slate-500 font-normal">min</span></span>
           </div>

           {/* Distance */}
           <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Distance</span>
              <span className="text-2xl font-mono text-white">{(data.tripDistance || 0).toFixed(1)} <span className="text-xs font-sans text-slate-500 font-normal">km</span></span>
           </div>

           {/* Avg Speed */}
           <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Avg Speed</span>
              <span className="text-xl font-mono text-white">{avgSpeed.toFixed(0)} <span className="text-xs font-sans text-slate-500 font-normal">km/h</span></span>
           </div>

           {/* Consumption */}
           <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Avg Consumption</span>
              <span className="text-xl font-mono text-white">{Math.round(data.tripConsumptionAvg || 0)} <span className="text-xs font-sans text-slate-500 font-normal">Wh/km</span></span>
           </div>

           {/* Total Energy */}
           <div className="flex flex-col col-span-2 border-t border-slate-700 mt-2 pt-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Total Energy Used</span>
                <span className="text-lg font-mono text-white">{(data.tripEnergyUsed || 0).toFixed(2)} <span className="text-xs font-sans text-slate-500 font-normal">kWh</span></span>
              </div>
           </div>
        </div>
      </div>

      {/* REAL-TIME MAP INFO */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📍</span>
          <span className="text-sm font-bold text-white truncate flex-1">{data.locationName || 'Unknown Location'}</span>
          <div className="text-right">
             <div className="text-[9px] text-slate-500 uppercase">Elevation</div>
             <div className="text-[10px] font-bold">{Math.round(data.elevation || 0)}m</div>
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-700/50">
          <span>GPS Quality: {data.gpsQuality}%</span>
          <span>Satellites: {data.gpsSats || 0}</span>
        </div>
      </div>
    </div>
  );
};

export default StatusCard;
