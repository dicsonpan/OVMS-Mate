import React from 'react';
import { VehicleState, TelemetryData } from '../types';

interface StatusCardProps {
  status: VehicleState;
  data: TelemetryData;
}

const StatusCard: React.FC<StatusCardProps> = ({ status, data }) => {
  const isCharging = status === VehicleState.Charging;
  const isDriving = status === VehicleState.Driving;

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
            <span className={`w-2 h-2 rounded-full ${status === VehicleState.Offline ? 'bg-red-500' : 'bg-green-500'}`}></span>
            {status} 
            {data.locationName && ` • ${data.locationName}`}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-black ${batteryColor}`}>
            {data.soc}%
          </div>
          <div className="text-slate-400 text-sm">{data.range} km range</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Primary Metric */}
        <div className="bg-slate-700/50 p-4 rounded-xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
            {isCharging ? 'Charge Power' : 'Power'}
          </p>
          <p className="text-2xl font-mono text-white">
            {Math.abs(data.power).toFixed(1)} <span className="text-sm text-slate-400">kW</span>
          </p>
          {isCharging && <p className="text-xs text-green-400 mt-1">~2h 10m remain</p>}
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

      {/* Temperature Strip */}
      <div className="mt-6 flex justify-between items-center text-sm text-slate-400 border-t border-slate-700 pt-4">
        <div className="flex items-center gap-2">
          <span>🔋 {data.tempBattery}°C</span>
          <span>⚙️ {data.tempMotor}°C</span>
        </div>
        <div>
          Last update: Just now
        </div>
      </div>
    </div>
  );
};

export default StatusCard;
