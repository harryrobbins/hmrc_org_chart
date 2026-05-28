import React, { useMemo, useState } from 'react';
import { Users, Building2, MapPin, Briefcase, Award, TrendingUp } from 'lucide-react';

export default function AnalyticsView({ data, flatNodes, regionFilter, professionFilter }) {
  const [hoveredBar, setHoveredBar] = useState(null);

  // Compute filtered statistical aggregates dynamically
  const computedStats = useMemo(() => {
    if (!data) return { totalFte: 0, seniorCount: 0, juniorFte: 0, regions: {}, professions: {}, grades: {} };

    let totalFte = 0;
    let seniorCount = 0;
    let juniorFte = 0;

    const regionsMap = {};
    const professionsMap = {};
    const gradesMap = {};

    // Helper to evaluate matching
    const matchesFilters = (region, profession) => {
      if (regionFilter !== 'All' && region !== regionFilter) return false;
      if (professionFilter !== 'All' && profession !== professionFilter) return false;
      return true;
    };

    flatNodes.forEach(node => {
      // 1. Process Senior Post
      const sRegion = node.regions[0] || 'Unknown';
      const sProfession = node.professions[0] || 'Other';
      const sGrade = node.grades[0] || 'SCS';

      if (matchesFilters(sRegion, sProfession)) {
        seniorCount++;
        totalFte += node.fte;
        
        regionsMap[sRegion] = (regionsMap[sRegion] || 0) + node.fte;
        professionsMap[sProfession] = (professionsMap[sProfession] || 0) + node.fte;
        gradesMap[sGrade] = (gradesMap[sGrade] || 0) + node.fte;
      }

      // 2. Process Associated Junior Cohorts
      node.juniorReports.forEach(j => {
        if (matchesFilters(j.region, j.profession)) {
          juniorFte += j.fte;
          totalFte += j.fte;

          regionsMap[j.region] = (regionsMap[j.region] || 0) + j.fte;
          professionsMap[j.profession] = (professionsMap[j.profession] || 0) + j.fte;
          gradesMap[j.grade] = (gradesMap[j.grade] || 0) + j.fte;
        }
      });
    });

    // Format distributions as sorted arrays
    const regionsArray = Object.entries(regionsMap)
      .filter(([name]) => name && name !== 'nan' && name !== 'Unknown')
      .map(([name, fte]) => ({ name, fte: parseFloat(fte.toFixed(1)) }))
      .sort((a, b) => b.fte - a.fte);

    const professionsArray = Object.entries(professionsMap)
      .filter(([name]) => name && name !== 'Other')
      .map(([name, fte]) => ({ name, fte: parseFloat(fte.toFixed(1)) }))
      .sort((a, b) => b.fte - a.fte);

    const gradesArray = Object.entries(gradesMap)
      .map(([name, fte]) => ({ name, fte: parseFloat(fte.toFixed(1)) }))
      .sort((a, b) => b.fte - a.fte);

    return {
      totalFte: parseFloat(totalFte.toFixed(1)),
      seniorCount,
      juniorFte: parseFloat(juniorFte.toFixed(1)),
      regions: regionsArray,
      professions: professionsArray,
      grades: gradesArray
    };
  }, [data, flatNodes, regionFilter, professionFilter]);

  // Layout calculations for regions SVG bar chart
  const regionsChartData = useMemo(() => {
    const list = computedStats.regions.slice(0, 10); // show top 10 regions
    if (list.length === 0) return [];
    
    const maxVal = Math.max(...list.map(d => d.fte));
    const chartHeight = 150;
    
    return list.map(item => ({
      ...item,
      height: maxVal > 0 ? (item.fte / maxVal) * chartHeight : 0
    }));
  }, [computedStats.regions]);

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-y-auto select-none">
      
      {/* Visual Header */}
      <div className="mb-6 fade-in">
        <h2 className="text-xl font-bold text-slate-100 light:text-slate-900 flex items-center gap-2">
          <TrendingUp size={20} className="text-cyan-400" /> HMRC Headcount Analytics
        </h2>
        <p className="text-xs text-slate-400 light:text-slate-500 mt-1">
          Dynamic metrics rolled up based on active filters (Region: <span className="text-cyan-400 font-bold">{regionFilter}</span>, Profession: <span className="text-cyan-400 font-bold">{professionFilter}</span>)
        </p>
      </div>

      {/* Grid of Key Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0 fade-in">
        <div className="glass-panel border border-white/[0.04] p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <div className="bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Headcount</div>
              <div className="text-2xl font-black text-slate-100 light:text-slate-900 font-mono mt-0.5">
                {computedStats.totalFte.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                <span className="text-xs text-slate-500 font-bold ml-1">FTE</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel border border-white/[0.04] p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <div className="bg-violet-500/10 p-3 rounded-xl border border-violet-500/20 text-violet-400 flex items-center justify-center">
              <Building2 size={24} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Senior Leadership</div>
              <div className="text-2xl font-black text-slate-100 light:text-slate-900 font-mono mt-0.5">
                {computedStats.seniorCount.toLocaleString()}
                <span className="text-xs text-slate-500 font-bold ml-1">SCS Posts</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel border border-white/[0.04] p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Award size={24} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operational Staff</div>
              <div className="text-2xl font-black text-slate-100 light:text-slate-900 font-mono mt-0.5">
                {computedStats.juniorFte.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                <span className="text-xs text-slate-500 font-bold ml-1">FTE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        
        {/* Regions Vertical Bar Chart */}
        <div className="glass-panel border border-white/[0.04] p-6 rounded-2xl flex flex-col shadow-lg min-h-[300px]">
          <h3 className="text-sm font-bold text-slate-300 light:text-slate-700 flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-cyan-400" /> Geographic Staffing (Top 10 Office Regions)
          </h3>
          
          <div className="flex-1 flex items-end justify-between gap-2 h-48 px-2 border-b border-white/5 relative">
            {regionsChartData.length > 0 ? (
              regionsChartData.map((item, idx) => (
                <div 
                  key={item.name} 
                  className="flex-1 flex flex-col items-center group relative cursor-pointer"
                  onMouseEnter={() => setHoveredBar({ index: idx, type: 'region' })}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Tooltip on bar hover */}
                  {hoveredBar && hoveredBar.type === 'region' && hoveredBar.index === idx && (
                    <div className="absolute bottom-full mb-2 bg-[#0e1422] border border-cyan-500 text-white rounded-lg p-2 text-[10px] text-center shadow-xl z-50 pointer-events-none whitespace-nowrap">
                      <div className="font-bold">{item.name}</div>
                      <div className="font-mono text-cyan-400 font-bold mt-0.5">{item.fte.toLocaleString()} FTE</div>
                    </div>
                  )}

                  {/* SVG styled Bar */}
                  <div 
                    className="w-full max-w-[28px] rounded-t-lg transition-all duration-300 border-t border-cyan-400/30 shadow-lg"
                    style={{ 
                      height: `${item.height}px`,
                      background: 'linear-gradient(to top, rgba(6, 182, 212, 0.25) 0%, rgba(6, 182, 212, 0.95) 100%)'
                    }}
                  />

                  {/* Value Label - Rotated elegantly to avoid overlap */}
                  <div 
                    className="text-[9px] text-slate-400 mt-2 truncate max-w-[70px] font-semibold pt-1 text-center"
                    style={{
                      transform: 'rotate(32deg)',
                      transformOrigin: 'left top',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.name}
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                No regional data available matching current filters.
              </div>
            )}
          </div>
          <div className="h-10" /> {/* Spacer for rotated labels */}
        </div>

        {/* Professions Horizontal Progress Bars */}
        <div className="glass-panel border border-white/[0.04] p-6 rounded-2xl flex flex-col shadow-lg min-h-[300px]">
          <h3 className="text-sm font-bold text-slate-300 light:text-slate-700 flex items-center gap-2 mb-4">
            <Briefcase size={16} className="text-cyan-400" /> Operational & Professional Domains (Top 5)
          </h3>
          
          <div className="flex-1 flex flex-col justify-center gap-4">
            {computedStats.professions.length > 0 ? (
              computedStats.professions.slice(0, 5).map((item, idx) => {
                const totalProf = computedStats.professions.reduce((a, b) => a + b.fte, 0);
                const percent = totalProf > 0 ? (item.fte / totalProf) * 100 : 0;
                
                // Colors array mapped directly to HSL/Hex values
                const gradients = [
                  ['#06b6d4', '#22d3ee'], // Cyan
                  ['#8b5cf6', '#a78bfa'], // Violet
                  ['#10b981', '#34d399'], // Emerald
                  ['#f59e0b', '#fbbf24'], // Amber
                  ['#f43f5e', '#fb7185']  // Rose
                ];
                const [colorStart, colorEnd] = gradients[idx % gradients.length];
                
                return (
                  <div key={item.name} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-slate-300 light:text-slate-700 truncate max-w-[240px]">
                        {item.name}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {item.fte.toLocaleString()} FTE ({percent.toFixed(1)}%)
                      </span>
                    </div>
                    {/* Glowing progress slider background */}
                    <div className="w-full h-2.5 bg-slate-900 light:bg-slate-200 rounded-full border border-white/[0.03] overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${percent}%`,
                          background: `linear-gradient(90deg, ${colorStart} 0%, ${colorEnd} 100%)`
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                No professional group data available matching current filters.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Civil Service Grade Breakdown Row */}
      <div className="glass-panel border border-white/[0.04] p-6 rounded-2xl flex flex-col shadow-lg mt-8 mb-4 shrink-0 fade-in">
        <h3 className="text-sm font-bold text-slate-300 light:text-slate-700 flex items-center gap-2 mb-6">
          <Award size={16} className="text-cyan-400" /> Hierarchy Distribution (By Civil Service Grade Bands)
        </h3>

        <div className="flex flex-wrap gap-4 items-center justify-between">
          {computedStats.grades.length > 0 ? (
            computedStats.grades.map((grade, idx) => {
              const totalGrades = computedStats.grades.reduce((a, b) => a + b.fte, 0);
              const percent = totalGrades > 0 ? (grade.fte / totalGrades) * 100 : 0;
              
              return (
                <div 
                  key={grade.name} 
                  className="flex-1 min-w-[130px] bg-slate-950/40 light:bg-slate-200/40 border border-white/[0.03] p-3 rounded-xl flex flex-col shadow-md transition-all duration-300 hover:border-cyan-500/20"
                >
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    {grade.name}
                  </span>
                  <span className="text-base font-black text-slate-100 light:text-slate-950 font-mono mt-1">
                    {grade.fte.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[10px] text-slate-500 font-bold">FTE</span>
                  </span>
                  {/* Tiny progress slider badge */}
                  <div className="w-full h-1 bg-slate-900 light:bg-slate-300 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-[8.5px] text-cyan-400/80 font-bold text-right mt-1 font-mono">
                    {percent.toFixed(1)}%
                  </span>
                </div>
              );
            })
          ) : (
            <div className="w-full text-center text-xs text-slate-500 py-4">
              No grade distribution data available matching current filters.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
