import React from 'react';
import { VehicleState, TelemetryData } from '../types';

interface StatusCardProps {
  status: VehicleState;
  data: TelemetryData;
}

const StatusCard: React.FC<StatusCardProps> = ({ status, data }) => {
  // Logic to determine vehicle state
  const effectiveStatus = data.chargeState === 'charging' ? VehicleState.Charging 
    : (data.speed > 0 || data.gear === 'D' || data.gear === 'R') ? VehicleState.Driving 
    : status;

  const isCharging = effectiveStatus === VehicleState.Charging;
  const isDriving = effectiveStatus === VehicleState.Driving;

  // Determine Battery Color
  let batteryColor = 'text-green-500';
  if (data.soc < 20) batteryColor = 'text-red-500';
  else if (data.soc < 50) batteryColor = 'text-yellow-500';

  // Helper for metrics
  const getRaw = (key: string) => data.rawMetrics ? data.rawMetrics[key] : undefined;

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <div className="w-full bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700 relative overflow-hidden">
        {/* Background Status Indicator */}
        <div className={`absolute top-0 left-0 w-1 h-full ${
          effectiveStatus === VehicleState.Driving ? 'bg-blue-500' :
          effectiveStatus === VehicleState.Charging ? 'bg-green-500' : 
          'bg-slate-600'
        }`}></div>

        <div className="flex justify-between items-start mb-6 pl-2">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              {data.vehicleId || 'OVMS Car'}
              {data.locked !== undefined && (
                <span className={`text-sm px-2 py-0.5 rounded-full ${data.locked ? 'bg-slate-700 text-slate-400' : 'bg-red-900/50 text-red-400'}`}>
                  {data.locked ? 'Locked' : 'Unlocked'}
                </span>
              )}
            </h2>
            <p className="text-slate-400 text-sm flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${effectiveStatus === VehicleState.Offline ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></span>
              <span className="uppercase font-semibold tracking-wide">{effectiveStatus}</span>
              {data.gear && <span className="bg-slate-700 px-1.5 rounded text-xs text-white font-mono">{data.gear}</span>}
              {data.locationName && ` • ${data.locationName}`}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-5xl font-black ${batteryColor} flex items-baseline justify-end gap-1`}>
              {data.soc}<span className="text-xl">%</span>
            </div>
            <div className="text-slate-400 text-sm font-medium mt-1">
               {data.estRange || data.range} km <span className="text-slate-600">range</span>
            </div>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pl-2">
          {/* Power / Voltage */}
          <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-700/50">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-1">
              {isCharging ? 'Charging Power' : 'Power Output'}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono text-white font-bold">
                {isCharging 
                  ? (data.power || (data.voltage * data.current / 1000)).toFixed(1)
                  : data.power.toFixed(1)
                }
              </span>
              <span className="text-sm text-slate-500">kW</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 font-mono">
              {data.voltage.toFixed(0)}V • {data.current.toFixed(1)}A
            </div>
          </div>

          {/* Speed / Odometer */}
          <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-700/50">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-1">
              {isDriving ? 'Current Speed' : 'Odometer'}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono text-white font-bold">
                 {isDriving ? data.speed.toFixed(0) : (data.odometer / 1000).toFixed(1)} 
              </span>
              <span className="text-sm text-slate-500">{isDriving ? 'km/h' : 'k km'}</span>
            </div>
             {!isDriving && (
               <div className="text-xs text-slate-500 mt-1">
                 Efficiency: {getRaw('v.b.consumption.average') || '--'} Wh/km
               </div>
             )}
          </div>
        </div>
        
        {/* Firmware / Version */}
        {getRaw('v.s.firmware') && (
           <div className="mt-4 text-center text-[10px] text-slate-600 font-mono">
              FW: {getRaw('v.s.firmware')}
           </div>
        )}
      </div>

      {/* Climate & Tires Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Climate */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm">
           <h3 className="text-xs uppercase text-slate-400 font-bold mb-3 flex items-center gap-2">
             <span>🌡️</span> Climate
           </h3>
           <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-slate-400">Inside</div>
              <div className="text-right text-white font-mono">{data.insideTemp ?? '--'}°C</div>
              
              <div className="text-slate-400">Outside</div>
              <div className="text-right text-white font-mono">{data.outsideTemp ?? '--'}°C</div>
              
              <div className="text-slate-400">Battery</div>
              <div className="text-right text-white font-mono">{data.tempBattery}°C</div>
              
              <div className="text-slate-400">Motor</div>
              <div className="text-right text-white font-mono">{data.tempMotor}°C</div>
           </div>
        </div>

        {/* Tire Pressure */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm relative">
           <h3 className="text-xs uppercase text-slate-400 font-bold mb-3 flex items-center gap-2">
             <span>🏎️</span> Tires (Bar)
           </h3>
           {data.tpms ? (
             <div className="grid grid-cols-2 gap-4 text-center relative z-10">
               <div className="bg-slate-900/50 rounded p-2">
                  <div className="text-[10px] text-slate-500">FL</div>
                  <div className={`font-mono font-bold ${data.tpms.fl < 2.0 ? 'text-red-400' : 'text-blue-300'}`}>
                    {data.tpms.fl?.toFixed(1) || '-'}
                  </div>
               </div>
               <div className="bg-slate-900/50 rounded p-2">
                  <div className="text-[10px] text-slate-500">FR</div>
                  <div className={`font-mono font-bold ${data.tpms.fr < 2.0 ? 'text-red-400' : 'text-blue-300'}`}>
                    {data.tpms.fr?.toFixed(1) || '-'}
                  </div>
               </div>
               <div className="bg-slate-900/50 rounded p-2">
                  <div className="text-[10px] text-slate-500">RL</div>
                  <div className={`font-mono font-bold ${data.tpms.rl < 2.0 ? 'text-red-400' : 'text-blue-300'}`}>
                    {data.tpms.rl?.toFixed(1) || '-'}
                  </div>
               </div>
               <div className="bg-slate-900/50 rounded p-2">
                  <div className="text-[10px] text-slate-500">RR</div>
                  <div className={`font-mono font-bold ${data.tpms.rr < 2.0 ? 'text-red-400' : 'text-blue-300'}`}>
                    {data.tpms.rr?.toFixed(1) || '-'}
                  </div>
               </div>
             </div>
           ) : (
             <div className="flex items-center justify-center h-20 text-xs text-slate-600 italic">
               No TPMS Data
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default StatusCard;
