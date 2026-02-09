
import React, { useState } from 'react';
import { DriveSession } from '../types';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end px-1">
        <h3 className="text-xl font-bold">Recent Drives</h3>
        <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Last 30 trips</span>
      </div>

      {drives.length === 0 && (
        <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-xl p-10 text-center text-slate-500 text-sm">
          No drives recorded yet.
        </div>
      )}

      {drives.map((drive) => (
        <div key={drive.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-md group">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                {new Date(drive.startDate).toLocaleDateString()} 
                {!drive.endDate && (
                   <span className="bg-blue-500 text-[10px] px-1.5 py-0.5 rounded text-white animate-pulse uppercase">Live</span>
                )}
              </div>
              <div className="text-xs text-slate-400 font-medium">
                {new Date(drive.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                {drive.endDate && ` → ${new Date(drive.endDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-mono text-xl font-bold ${drive.efficiency > 0 && drive.efficiency < 160 ? 'text-green-400' : 'text-slate-300'}`}>
                {drive.efficiency || 0} <span className="text-xs font-normal text-slate-500">Wh/km</span>
              </div>
              <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                 <span className="bg-slate-700 px-1 rounded text-slate-300">{drive.startSoc}%</span>
                 <span>→</span>
                 <span className="bg-slate-700 px-1 rounded text-slate-300">{drive.endSoc || drive.startSoc}%</span>
              </div>
            </div>
          </div>

          {/* Core Stats Row */}
          <div className="flex gap-4 mb-4">
             <div className="flex-1 bg-slate-900/40 rounded-lg p-2 text-center border border-slate-700/30">
                <div className="text-[10px] text-slate-500 uppercase">Distance</div>
                <div className="text-sm font-bold text-white">{drive.distance.toFixed(1)} <span className="text-[10px] font-normal">km</span></div>
             </div>
             <div className="flex-1 bg-slate-900/40 rounded-lg p-2 text-center border border-slate-700/30">
                <div className="text-[10px] text-slate-500 uppercase">Duration</div>
                <div className="text-sm font-bold text-white">{drive.duration} <span className="text-[10px] font-normal">min</span></div>
             </div>
             <div className="flex-1 bg-slate-900/40 rounded-lg p-2 text-center border border-slate-700/30">
                <div className="text-[10px] text-slate-500 uppercase">Energy</div>
                <div className="text-sm font-bold text-white">{drive.consumption.toFixed(2)} <span className="text-[10px] font-normal">kWh</span></div>
             </div>
          </div>

          {/* Mini Chart (Speed Profile) */}
          <div 
            className="h-20 w-full mb-3 bg-slate-900/60 rounded-lg border border-slate-700/50 p-2 cursor-pointer hover:border-blue-500/50 transition-colors"
            onClick={() => onViewMap(drive)}
          >
            {drive.path && drive.path.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={drive.path}>
                  <Line type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <XAxis hide />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ display: 'none' }}
                    formatter={(val: number) => [`${val} km/h`, 'Speed']}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[10px] text-slate-600 italic">
                Capturing trajectory...
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex justify-between items-center pt-1">
            <button 
              onClick={() => onViewMap(drive)}
              className="text-xs text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1.5 px-2 py-1 rounded bg-slate-700/30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7" />
              </svg>
              View Route
            </button>
            
            <button 
              onClick={() => handleAnalyze(drive)}
              disabled={analyzingId === drive.id || !drive.endDate}
              className="flex items-center gap-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {analyzingId === drive.id ? (
                <>
                  <span className="animate-spin h-2.5 w-2.5 border-2 border-white border-t-transparent rounded-full"></span>
                  Analysing
                </>
              ) : (
                <>
                  <span className="text-xs">✨</span> AI Insight
                </>
              )}
            </button>
          </div>

          {/* AI Result */}
          {analysisResult && analysisResult.id === drive.id && (
            <div className="mt-4 bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/20 text-xs text-indigo-100 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2">
                <span className="text-lg">🤖</span>
                <p className="whitespace-pre-line leading-relaxed opacity-90">{analysisResult.text}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DriveList;