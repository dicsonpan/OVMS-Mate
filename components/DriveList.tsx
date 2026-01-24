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
      <h3 className="text-xl font-bold px-1">Recent Drives</h3>
      {drives.map((drive) => (
        <div key={drive.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-md">
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="text-lg font-bold text-white">
                {new Date(drive.startDate).toLocaleDateString()} 
                <span className="text-slate-400 text-sm ml-2">
                  {new Date(drive.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <div className="text-sm text-slate-400">
                {drive.duration} min • {drive.distance} km
              </div>
            </div>
            <div className="text-right">
              <div className={`font-mono text-lg ${drive.efficiency < 160 ? 'text-green-400' : 'text-yellow-400'}`}>
                {drive.efficiency} <span className="text-xs">Wh/km</span>
              </div>
              <div className="text-xs text-slate-500">
                 {drive.startSoc}% → {drive.endSoc}%
              </div>
            </div>
          </div>

          {/* Mini Chart Visualization */}
          <div className="h-16 w-full mb-3" onClick={() => onViewMap(drive)}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={drive.path}>
                <Line type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <XAxis dataKey="lat" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ display: 'none' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Action Bar */}
          <div className="flex justify-between items-center border-t border-slate-700 pt-3">
            <button 
              onClick={() => onViewMap(drive)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7" />
              </svg>
              View Route
            </button>
            
            <button 
              onClick={() => handleAnalyze(drive)}
              disabled={analyzingId === drive.id}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-full transition-all disabled:opacity-50"
            >
              {analyzingId === drive.id ? (
                <>
                  <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
                  Analysing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  AI Insight
                </>
              )}
            </button>
          </div>

          {/* AI Result */}
          {analysisResult && analysisResult.id === drive.id && (
            <div className="mt-3 bg-indigo-900/30 p-3 rounded-lg border border-indigo-500/30 text-sm text-indigo-100 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2">
                <span className="text-xl">✨</span>
                <div className="markdown-body">
                   <p className="whitespace-pre-line leading-relaxed">{analysisResult.text}</p>
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