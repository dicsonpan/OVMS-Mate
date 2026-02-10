
import React, { useState, useEffect, useMemo } from 'react';
import { ChargeSession, OvmsConfig } from '../types';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { fetchCharges } from '../services/dataService';

interface ChargingStatsProps {
  config: OvmsConfig;
}

const PAGE_SIZE = 10;

const ChargingStats: React.FC<ChargingStatsProps> = ({ config }) => {
  const [charges, setCharges] = useState<ChargeSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Initial Load
  useEffect(() => {
    loadCharges(true);
  }, []);

  const loadCharges = async (reset = false) => {
    setLoading(true);
    const currentPage = reset ? 0 : page;
    const currentOffset = currentPage * PAGE_SIZE;

    const newCharges = await fetchCharges({
      limit: PAGE_SIZE,
      offset: currentOffset,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    });

    if (reset) {
      setCharges(newCharges);
      setPage(1);
    } else {
      setCharges(prev => [...prev, ...newCharges]);
      setPage(prev => prev + 1);
    }

    if (newCharges.length < PAGE_SIZE) setHasMore(false);
    else setHasMore(true);
    
    setLoading(false);
  };

  const handleFilter = () => loadCharges(true);
  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    // Use timeout to break batching and force reload after state clear
    setTimeout(() => {
        setLoading(true);
        fetchCharges({ limit: PAGE_SIZE, offset: 0 }).then(data => {
            setCharges(data);
            setPage(1);
            setHasMore(data.length >= PAGE_SIZE);
            setLoading(false);
        });
    }, 0);
  };

  // --- Calculations ---
  const summary = useMemo(() => {
     // 3. Current page totals (or could be all fetched if we wanted, but standard behavior is usually current view)
     // To get TOTAL of everything matching filters, we'd need a separate aggregate query. 
     // For now, let's sum up what is loaded (which mimics the 'current page' behavior described)
     const totalKwh = charges.reduce((acc, curr) => acc + curr.addedKwh, 0);
     const costPerKwh = config.costPerKwh || 0; 
     const totalCost = totalKwh * costPerKwh;
     return { totalKwh, totalCost };
  }, [charges, config]);

  const formatCurrency = (val: number) => {
     const currency = config.currency || 'USD';
     // Handle common symbols
     if (currency === 'USD') return `$${val.toFixed(2)}`;
     if (currency === 'EUR') return `€${val.toFixed(2)}`;
     if (currency === 'GBP') return `£${val.toFixed(2)}`;
     if (currency === 'CNY' || currency === 'JPY') return `¥${val.toFixed(2)}`;
     return `${val.toFixed(2)} ${currency}`;
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* SUMMARY HEADER */}
      <div className="flex justify-between items-end px-1">
        <h3 className="text-2xl font-bold text-white">Charging History</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden group">
           <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
               </svg>
           </div>
           <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Total Added</div>
           <div className="text-3xl font-bold text-green-400">
             {summary.totalKwh.toFixed(1)} <span className="text-sm font-normal text-slate-500">kWh</span>
           </div>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden group">
           <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                 <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                 <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
               </svg>
           </div>
           <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Total Cost</div>
           <div className="text-3xl font-bold text-white">
             {formatCurrency(summary.totalCost)}
           </div>
           {(!config.costPerKwh || config.costPerKwh === 0) && (
               <div className="text-[9px] text-orange-400 mt-1">Configure cost in Settings</div>
           )}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex flex-wrap gap-2 items-center justify-between">
         <div className="flex gap-2 items-center flex-1">
             <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500 w-full"
                placeholder="Start Date"
             />
             <span className="text-slate-500">-</span>
             <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500 w-full"
                placeholder="End Date"
             />
         </div>
         <div className="flex gap-2">
            <button 
                onClick={handleFilter}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
                Filter
            </button>
            {(startDate || endDate) && (
                <button 
                    onClick={handleReset}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                >
                    Reset
                </button>
            )}
         </div>
      </div>

      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Recent Sessions
        </span>
      </div>
      
      {charges.length === 0 && !loading && (
        <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-xl p-10 text-center text-slate-500 text-sm">
          No charge sessions found.
        </div>
      )}

      {charges.map(charge => (
        <ChargeCard key={charge.id} charge={charge} />
      ))}

      {/* PAGINATION */}
      {hasMore && (
        <div className="pt-4 text-center">
            <button 
                onClick={() => loadCharges()}
                disabled={loading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold py-3 px-8 rounded-full transition-colors disabled:opacity-50"
            >
                {loading ? 'Loading...' : 'Load More'}
            </button>
        </div>
      )}
    </div>
  );
};

// --- Sub-component: Individual Charge Card ---
const ChargeCard: React.FC<{ charge: ChargeSession }> = ({ charge }) => {
    const [displayLocation, setDisplayLocation] = useState(charge.location || 'Loading...');

    // Location Logic: Name -> Coordinates -> Reverse Geocode
    useEffect(() => {
        // 1. Prefer existing name from v.p.location
        if (charge.location && charge.location.trim() !== '' && charge.location !== 'Unknown') {
            setDisplayLocation(charge.location);
            return;
        }

        // 2. Fallback to Address via Reverse Geocoding
        if (charge.latitude && charge.longitude) {
            // Show coords momentarily
            const coordStr = `${charge.latitude.toFixed(4)}, ${charge.longitude.toFixed(4)}`;
            // Only update if we haven't already
            if(displayLocation === 'Loading...') setDisplayLocation(coordStr);

            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${charge.latitude}&lon=${charge.longitude}&zoom=18&addressdetails=1`, {
                headers: { 'User-Agent': 'OVMS-Mate/1.0' }
            })
            .then(res => res.json())
            .then(json => {
                if (json.address) {
                    const { road, house_number } = json.address;
                    if (road) {
                        setDisplayLocation(`${road} ${house_number || ''}`);
                    }
                }
            })
            .catch(() => {});
        } else {
            setDisplayLocation('Unknown Location');
        }
    }, [charge.location, charge.latitude, charge.longitude]);

    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Chart Data Preparation
    // TeslaMate style: Green gradient area chart
    const chartData = useMemo(() => {
        if(!charge.chartData) return [];
        return charge.chartData.map((pt, index) => ({
            ...pt,
            // X-axis is often cleaner as 'minutes since start'
            relTime: index, // simplified
            displayTime: new Date(pt.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
        }));
    }, [charge.chartData]);

    return (
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
          {/* HEADER */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-xl font-bold text-white flex items-center gap-2">
                 {/* Optional Location Pin */}
                 {displayLocation}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {new Date(charge.date).toLocaleDateString()} &bull; {formatTime(charge.date)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">+{charge.addedKwh.toFixed(1)} <span className="text-sm text-green-600">kWh</span></div>
              <div className="text-slate-400 font-mono text-sm">{Math.round(charge.duration)} min</div>
            </div>
          </div>

          {/* CHART AREA */}
          <div className="h-48 w-full bg-slate-900/40 rounded-xl p-0 border border-slate-700/50 mb-4 relative overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                   <linearGradient id={`gradient-${charge.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                   </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="displayTime" hide />
                <YAxis hide domain={[0, 'auto']} />
                
                {/* Custom Tooltip matching screenshot style */}
                <Tooltip 
                  content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-800/90 border border-slate-600 p-3 rounded-lg shadow-xl backdrop-blur-md">
                            <p className="text-slate-400 text-xs mb-1">
                                {payload[0].payload.displayTime}
                            </p>
                            <p className="text-green-400 font-bold text-lg">
                                Power: {payload[0].value} kW
                            </p>
                          </div>
                        );
                      }
                      return null;
                  }}
                />
                
                <Area 
                  type="monotone" 
                  dataKey="power" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  fill={`url(#gradient-${charge.id})`}
                  fillOpacity={1}
                />
              </AreaChart>
            </ResponsiveContainer>
            
            {/* Overlay stats: Start SoC -> End SoC on chart? Or just text below. 
                Screenshot shows a green dot on the line. We can add a dot via activeDot but simple is fine. 
            */}
          </div>
          
          {/* FOOTER STATS (Avg / Max) */}
          <div className="flex justify-between items-center text-sm">
             <div className="flex gap-6">
                 <div>
                    <span className="text-slate-500 font-bold block mb-0.5">Avg</span>
                    <span className="text-slate-300 font-mono text-lg">{charge.avgPower.toFixed(1)} kW</span>
                 </div>
                 <div>
                    <span className="text-slate-500 font-bold block mb-0.5">Max</span>
                    <span className="text-slate-300 font-mono text-lg">{charge.maxPower.toFixed(1)} kW</span>
                 </div>
             </div>

             {/* SoC Badge */}
             <div className="bg-slate-700/50 px-3 py-1.5 rounded-lg border border-slate-600 flex items-center gap-2">
                <span className="text-slate-400 font-bold">{charge.startSoc}%</span>
                <span className="text-slate-600 text-xs">➜</span>
                <span className="text-green-400 font-bold">{charge.endSoc}%</span>
             </div>
          </div>
        </div>
    );
};

export default ChargingStats;
