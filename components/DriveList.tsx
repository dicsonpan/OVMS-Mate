
import React, { useState } from 'react';
import { DriveSession } from '../types';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { analyzeDriveEfficiency } from '../services/geminiService';

interface DriveListProps {
  drives: DriveSession[];
  onViewMap: (drive: DriveSession) => void;
}

const DriveList: React.FC<DriveListProps> = ({ drives, onViewMap }) => {
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{id: string, text: string} | null>(null);

  const handleAnalyze = async (drive: DriveSession) => {
    setAnalyzingId(drive.id);
    setAnalysisResult(null);
    const result = await analyzeDriveEfficiency(drive);
    setAnalysisResult({ id: drive.id, text: result });
    setAnalyzingId(null);
  };

  // Helper to format duration like "45 min" or "1 h 12 min"
  const formatDuration = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h} h ${m} min`;
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end px-1">
        <h3 className="text-2xl font-bold text-white">Recent Drives</h3>
        <span className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Last 30 trips</span>
      </div>

      {drives.length === 0 && (
        <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-xl p-10 text-center text-slate-500 text-sm">
          No drives recorded yet.
        </div>
      )}

      {drives.map((drive) => (
        <div key={drive.id} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl overflow-hidden relative">
          
          {/* HEADER ROW: Date/Time & Efficiency/SoC */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="text-3xl font-bold text-white tracking-tight">
                {formatDate(drive.startDate)}
              </div>
              <div className="text-lg text-slate-400 font-medium mt-1">
                {formatTime(drive.startDate)} <span className="text-slate-600 mx-1">➜</span> {drive.endDate ? formatTime(drive.endDate) : 'On going'}
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1 mb-1">
                <span className={`text-4xl font-bold ${drive.efficiency < 165 ? 'text-green-400' : 'text-slate-200'}`}>
                  {Math.round(drive.efficiency || 0)}
                </span>
                <span className="text-sm font-bold text-slate-500">Wh/km</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-sm font-bold">
                 <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded-md">{drive.startSoc}%</span>
                 <span className="text-slate-500">➜</span>
                 <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded-md">{drive.endSoc || drive.startSoc}%</span>
              </div>
            </div>
          </div>

          {/* METRICS GRID: Distance, Duration, Energy */}
          <div className="grid grid-cols-3 gap-4 mb-8">
             {/* Distance */}
             <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50 flex flex-col justify-center">
                <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">Distance</div>
                <div className="text-2xl font-bold text-white">
                  {drive.distance.toFixed(1)} <span className="text-sm font-normal text-slate-400">km</span>
                </div>
             </div>

             {/* Duration */}
             <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50 flex flex-col justify-center">
                <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">Duration</div>
                <div className="text-2xl font-bold text-white">
                  {Math.round(drive.duration)} <span className="text-sm font-normal text-slate-400">min</span>
                </div>
             </div>

             {/* Energy */}
             <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50 flex flex-col justify-center">
                <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">Energy</div>
                <div className="text-2xl font-bold text-white">
                  {drive.consumption.toFixed(2)} <span className="text-sm font-normal text-slate-400">kWh</span>
                </div>
             </div>
          </div>

          {/* SPEED CHART */}
          <div className="relative h-24 w-full mb-6 bg-slate-900/20 rounded-xl border border-slate-700/30 overflow-hidden">
             {/* Average Speed Overlay */}
            <div className="absolute top-3 left-4 z-10 bg-slate-900/80 px-2 py-1 rounded text-[10px] text-slate-300 backdrop-blur-sm border border-slate-700">
               Avg Speed: {(drive.distance / (drive.duration/60)).toFixed(1)} km/h
            </div>

            {drive.path && drive.path.length > 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={drive.path}>
                  <defs>
                    <linearGradient id={`speedGradient-${drive.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                    labelStyle={{ display: 'none' }}
                    formatter={(val: number) => [`${val.toFixed(0)} km/h`, 'Speed']}
                  />
                  <XAxis dataKey="ts" hide />
                  <YAxis hide domain={[0, 'dataMax + 10']} />
                  <Area 
                    type="monotone" 
                    dataKey="speed" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill={`url(#speedGradient-${drive.id})`} 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-600 italic">
                Not enough chart data
              </div>
            )}
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex justify-between items-center">
            <button 
              onClick={() => onViewMap(drive)}
              className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-700/30 hover:bg-slate-700/50 px-3 py-2 rounded-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7" />
              </svg>
              <span className="text-sm font-medium">View Route</span>
            </button>

            <button 
               onClick={() => handleAnalyze(drive)}
               disabled={analyzingId === drive.id}
               className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg shadow-indigo-900/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {analyzingId === drive.id ? (
                 <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM9 15a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 15z" />
                 </svg>
               )}
               <span className="text-sm font-bold">AI Insight</span>
            </button>
          </div>

          {/* AI RESULT CARD */}
          {analysisResult && analysisResult.id === drive.id && (
            <div className="mt-4 bg-indigo-950/40 border border-indigo-500/30 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex gap-3">
                 <div className="bg-indigo-500/20 p-2 rounded-full h-fit">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-300" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                 </div>
                 <div className="text-sm text-indigo-100 leading-relaxed whitespace-pre-line">
                   {analysisResult.text}
                 </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DriveList;
