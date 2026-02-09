
import React from 'react';
import { VehicleState, TelemetryData } from '../types';

interface StatusCardProps {
  status: VehicleState;
  data: TelemetryData;
}

const StatusCard: React.FC<StatusCardProps> = ({ status, data }) => {
  if (!data) return null;

  const chargingStates = ['charging', 'topoff', 'heating', 'prepare', 'timerwait'];
  const driving = (data.speed > 0 || (data.gear !== 'P' && data.gear !== undefined && data.gear !== '0'));

  let effectiveStatus = status;
  if (data.chargeState && chargingStates.includes(data.chargeState.toLowerCase())) {
    effectiveStatus = VehicleState.Charging;
  } else if (driving) {
    effectiveStatus = VehicleState.Driving;
  } else if (data.carAwake === false) {
    effectiveStatus = VehicleState.Asleep;
  } else {
    effectiveStatus = (status === VehicleState.Offline) ? VehicleState.Offline : VehicleState.Parked;
  }

  const isCharging = effectiveStatus === VehicleState.Charging;
  const isDriving = effectiveStatus === VehicleState.Driving;

  let batteryColor = 'text-green-500';
  if (data.soc < 20) batteryColor = 'text-red-500';
  else if (data.soc < 50) batteryColor = 'text-yellow-500';

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <div className="w-full bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700 relative overflow-hidden transition-all duration-500">
        <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-500 ${
          isDriving ? 'bg-blue-500' :
          isCharging ? 'bg-green-500' : 
          effectiveStatus === VehicleState.Asleep ? 'bg-purple-900' :
          'bg-slate-600'
        }`}></div>

        {/* Header Section */}
        <div className="flex justify-between items-start mb-6 pl-3">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              {data.vehicleId || 'OVMS Car'}
              {data.locked !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full border shadow-inner transition-all duration-300 ${
                  data.locked 
                    ? 'bg-slate-900/50 border-slate-600 text-slate-500' 
                    : 'bg-red-500/10 border-red-500/50 text-red-400 animate-pulse font-bold'
                }`}>
                  {data.locked ? '🔒 Locked' : '🔓 Unlocked'}
                </span>
              )}
            </h2>
            <p className="text-slate-400 text-sm flex items-center gap-2 mt-2">
              <span className={`w-2.5 h-2.5 rounded-full shadow-lg transition-colors duration-500 ${
                effectiveStatus === VehicleState.Offline ? 'bg-red-600' : 
                effectiveStatus === VehicleState.Asleep ? 'bg-purple-600' :
                'bg-green-500 animate-pulse'
              }`}></span>
              <span className="uppercase font-bold tracking-wider text-xs bg-slate-700/50 px-2 py-0.5 rounded">
                {effectiveStatus}
              </span>
              {data.gear && (
                <span className={`font-mono font-bold px-1.5 rounded text-xs ${
                  data.gear === 'P' ? 'bg-slate-700 text-slate-300' :
                  data.gear === 'R' ? 'bg-red-900/50 text-red-300' :
                  data.gear === 'D' ? 'bg-blue-900/50 text-blue-300' :
                  'bg-slate-700 text-white'
                }`}>
                  {data.gear}
                </span>
              )}
              {data.parkTime != null && effectiveStatus === VehicleState.Parked && (
                <span className="text-[10px] text-slate-500">
                  Parked {Math.floor(data.parkTime / 3600)}h {Math.floor((data.parkTime % 3600) / 60)}m
                </span>
              )}
            </p>
          </div>

          <div className="text-right">
            <div className={`text-5xl font-black ${batteryColor} flex items-baseline justify-end gap-1 drop-shadow-sm`}>
              {data.soc != null ? data.soc.toFixed(0) : '--'}<span className="text-xl opacity-80">%</span>
            </div>
            <div className="text-slate-400 text-sm font-medium mt-1">
              <span className="text-white font-bold">{data.estRange != null ? data.estRange.toFixed(0) : '--'}</span> km 
              <span className="text-slate-600 text-xs ml-1">est.</span>
            </div>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pl-3">
          <div className={`p-4 rounded-xl border backdrop-blur-sm transition-colors ${isCharging ? 'bg-green-900/10 border-green-500/20' : 'bg-slate-700/30 border-slate-700/50'}`}>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">
              {isCharging ? 'Charging' : 'Power'}
            </p>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-mono font-bold ${isCharging ? 'text-green-400' : 'text-white'}`}>
                {data.power != null ? data.power.toFixed(1) : '0.0'}
              </span>
              <span className="text-sm text-slate-500">kW</span>
            </div>
            <div className="text-xs text-slate-500 mt-2 font-mono flex justify-between items-center">
              <span>{data.voltage != null ? data.voltage.toFixed(0) : '--'}V</span>
              <span className="h-3 w-px bg-slate-700"></span>
              <span>{data.current != null ? data.current.toFixed(1) : '--'}A</span>
            </div>
          </div>

          <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">
              {isDriving ? 'Speed' : 'Odometer'}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono text-white font-bold">
                 {isDriving ? (data.speed != null ? data.speed.toFixed(0) : '0') : (data.odometer != null ? Math.round(data.odometer) : '0')} 
              </span>
              <span className="text-sm text-slate-500">{isDriving ? 'km/h' : 'km'}</span>
            </div>
             <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between items-center text-xs">
                {data.voltage12v != null ? (
                   <div className="flex items-center gap-2" title="12V System">
                     <span className="text-[10px] bg-slate-800 px-1 rounded">12V</span>
                     <span className={`font-mono ${data.voltage12v < 12.0 ? 'text-red-400' : 'text-blue-300'}`}>
                       {data.voltage12v.toFixed(1)}V
                     </span>
                     {data.current12v != null && (
                       <span className={`font-mono text-[10px] ${data.current12v < 0 ? 'text-red-400' : 'text-green-400'}`}>
                         {data.current12v > 0 ? '+' : ''}{data.current12v.toFixed(1)}A
                       </span>
                     )}
                   </div>
                ) : (
                  <span className="text-[10px] text-slate-600">12V --</span>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Secondary Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Climate & Temps */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm">
           <div className="flex justify-between items-center mb-3">
             <h3 className="text-xs uppercase text-slate-400 font-bold flex items-center gap-2">
               <span>🌡️</span> Temperatures
             </h3>
             <div className="flex items-center gap-3">
               {data.tempAmbient != null && (
                 <span className="text-xs text-slate-300 font-medium">Amb: <span className="text-white font-bold">{data.tempAmbient.toFixed(1)}°</span></span>
               )}
               {data.outsideTemp != null && (
                 <span className="text-xs text-slate-300 font-medium">Out: <span className="text-white font-bold">{data.outsideTemp.toFixed(1)}°</span></span>
               )}
             </div>
           </div>
           
           <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900/50 rounded-lg p-2">
                <div className="text-[10px] text-slate-500 mb-1">Inside</div>
                <div className="text-white font-mono font-medium">{data.insideTemp != null ? data.insideTemp.toFixed(1) : '--'}°</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2">
                <div className="text-[10px] text-slate-500 mb-1">Battery</div>
                <div className={`${(data.tempBattery != null && (data.tempBattery > 35 || data.tempBattery < 5)) ? 'text-yellow-400' : 'text-blue-200'} font-mono font-medium`}>
                  {data.tempBattery != null ? data.tempBattery.toFixed(1) : '--'}°
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2">
                <div className="text-[10px] text-slate-500 mb-1">Motor</div>
                <div className="text-slate-300 font-mono font-medium">{data.tempMotor != null ? data.tempMotor.toFixed(1) : '--'}°</div>
              </div>
           </div>
        </div>

        {/* GPS & SoH Status */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm">
           <h3 className="text-xs uppercase text-slate-400 font-bold mb-3 flex items-center justify-between">
             <span className="flex items-center gap-2"><span>🏎️</span> System Health</span>
             {data.soh != null && <span className="text-[10px] text-green-400">Battery SoH: {data.soh}%</span>}
           </h3>
           
           <div className="flex items-center justify-between h-12 px-2 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[9px] uppercase">GPS Status</span>
                  <span className={data.gpsLock ? 'text-green-400' : 'text-red-400 font-bold'}>
                    {data.gpsLock ? 'Locked' : 'Searching...'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[9px] uppercase">Satellites</span>
                  <span className="text-white font-mono">{data.gpsSats || 0}</span>
                </div>
              </div>
              {data.elevation != null && (
                <div className="flex flex-col items-end">
                   <span className="text-slate-500 text-[9px] uppercase">Elevation</span>
                   <span className="text-white font-mono">{data.elevation.toFixed(0)}m</span>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default StatusCard;
