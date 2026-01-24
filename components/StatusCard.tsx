import React from 'react';
import { VehicleState, TelemetryData } from '../types';

interface StatusCardProps {
  status: VehicleState;
  data: TelemetryData;
}

const StatusCard: React.FC<StatusCardProps> = ({ status, data }) => {
  // Logic to determine vehicle state from data if passed as generic
  const effectiveStatus = data.chargeState === 'charging' ? VehicleState.Charging 
    : data.speed > 0 ? VehicleState.Driving 
    : status;

  const isCharging = effectiveStatus === VehicleState.Charging;
  const isDriving = effectiveStatus === VehicleState.Driving;

  // Determine Battery Color
  let batteryColor = 'text-green-500';
  if (data.soc < 20) batteryColor = 'text-red-500';
  else if (data.soc < 50) batteryColor = 'text-yellow-500';

  return (
    <div className="w-full bg-slate-800 rounded-2xl p-6 shadow-lg mb-4 border border-slate-700">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">BMW i3</h2>
          <p className="text-slate-400 text-sm flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${effectiveStatus === VehicleState.Offline ? 'bg-red-500' : 'bg-green-500'}`}></span>
            {effectiveStatus} 
            {data.locationName && ` • ${data.locationName}`}
          </p>
          {data.chargeState && data.chargeState !== 'stopped' && (
             <p className="text-blue-400 text-xs mt-1 capitalize font-mono">
               State: {data.chargeState}
             </p>
          )}
        </div>
        <div className="text-right">
          <div className={`text-4xl font-black ${batteryColor}`}>
            {data.soc}%
          </div>
          <div className="text-slate-400 text-sm">
             {data.estRange || data.range} km <span className="text-xs text-slate-500">(Est)</span>
          </div>
          {data.idealRange > 0 && (
             <div className="text-slate-500 text-xs">
               {data.idealRange} km (Ideal)
             </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Primary Metric */}
        <div className="bg-slate-700/50 p-4 rounded-xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
            {isCharging ? 'Charge Power' : 'Voltage'}
          </p>
          <p className="text-2xl font-mono text-white">
            {isCharging ? (data.power || (data.voltage * data.current / 1000)).toFixed(1) : data.voltage} 
            <span className="text-sm text-slate-400">{isCharging ? 'kW' : 'V'}</span>
          </p>
          {isCharging && (
            <p className="text-xs text-green-400 mt-1">
               {data.voltage}V • {data.current}A
            </p>
          )}
        </div>

        {/* Secondary Metric */}
        <div className="bg-slate-700/50 p-4 rounded-xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
            {isDriving ? 'Speed' : 'Odometer'}
          </p>
          <p className="text-2xl font-mono text-white">
             {isDriving ? data.speed.toFixed(0) : (data.odometer / 1000).toFixed(1)} 
             <span className="text-sm text-slate-400">{isDriving ? ' km/h' : ' k'}</span>
          </p>
        </div>
      </div>

      {/* Temperature Strip (Critical for i3) */}
      <div className="mt-6 flex justify-between items-center text-sm text-slate-400 border-t border-slate-700 pt-4">
        <div className="flex items-center gap-3">
          <div title="Battery Temp">
            🔋 <span className={data.tempBattery > 35 ? 'text-red-400' : 'text-slate-300'}>
              {data.tempBattery}°C
            </span>
          </div>
          <div title="Motor Temp">
            ⚙️ <span className="text-slate-300">{data.tempMotor}°C</span>
          </div>
          <div title="Ambient Temp">
            🌡️ <span className="text-slate-300">{data.tempAmbient}°C</span>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Live via OVMS
        </div>
      </div>
    </div>
  );
};

export default StatusCard;