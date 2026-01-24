import React from 'react';
import { ChargeSession } from '../types';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface ChargingStatsProps {
  charges: ChargeSession[];
}

const ChargingStats: React.FC<ChargingStatsProps> = ({ charges }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
           <p className="text-slate-400 text-xs uppercase">Total Charged</p>
           <p className="text-2xl font-bold text-green-400">60.5 <span className="text-sm">kWh</span></p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
           <p className="text-slate-400 text-xs uppercase">Avg Cost</p>
           <p className="text-2xl font-bold text-white">$0.12 <span className="text-sm">/kWh</span></p>
        </div>
      </div>

      <h3 className="text-xl font-bold px-1">Recent Sessions</h3>
      
      {charges.map(charge => (
        <div key={charge.id} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex justify-between mb-4">
            <div>
              <div className="font-bold">{charge.location}</div>
              <div className="text-xs text-slate-400">{new Date(charge.date).toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="text-green-400 font-bold">+{charge.addedKwh} kWh</div>
              <div className="text-xs text-slate-400">{charge.duration} min</div>
            </div>
          </div>

          <div className="h-32 w-full bg-slate-900/50 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charge.chartData}>
                <defs>
                  <linearGradient id={`grad${charge.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  itemStyle={{ color: '#4ade80' }}
                  formatter={(value: number) => [`${value} kW`, 'Power']}
                />
                <Area 
                  type="monotone" 
                  dataKey="power" 
                  stroke="#22c55e" 
                  fillOpacity={1} 
                  fill={`url(#grad${charge.id})`} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex justify-between mt-3 text-xs text-slate-500">
             <span>Avg: {charge.avgPower} kW</span>
             <span>Max: {charge.maxPower} kW</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChargingStats;
