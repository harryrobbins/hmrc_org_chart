import React, { useMemo } from 'react';
import { X, Mail, Phone, MapPin, Briefcase, Award, ArrowUpRight, TrendingUp, HelpCircle } from 'lucide-react';

export default function SidebarDrawer({ selectedNode, onClose, onSelectReport }) {
  
  // Custom department badge color styling
  const getDeptColorClass = (unit) => {
    const unitName = (unit || '').toLowerCase();
    if (unitName.includes('customer services') || unitName.includes('benefits')) return 'text-sky-400 border-sky-500/20 bg-sky-500/5';
    if (unitName.includes('compliance') || unitName.includes('fraud') || unitName.includes('large business')) return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
    if (unitName.includes('strategy') || unitName.includes('tax design')) return 'text-violet-400 border-violet-500/20 bg-violet-500/5';
    if (unitName.includes('digital') || unitName.includes('cdio') || unitName.includes('ddit')) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
    if (unitName.includes('finance') || unitName.includes('cfo')) return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    if (unitName.includes('people') || unitName.includes('place') || unitName.includes('hr')) return 'text-orange-400 border-orange-500/20 bg-orange-500/5';
    return 'text-slate-400 border-slate-500/20 bg-slate-500/5';
  };

  // Group direct junior reports by Grade, Profession, and Region for display
  const juniorBreakdown = useMemo(() => {
    if (!selectedNode || !selectedNode.juniorReports) return [];
    
    // Group by Grade + Profession + Region
    const groups = {};
    selectedNode.juniorReports.forEach(j => {
      const key = `${j.grade}-${j.profession}-${j.region}`;
      if (!groups[key]) {
        groups[key] = {
          grade: j.grade,
          profession: j.profession,
          region: j.region,
          fte: 0,
          minPay: j.minPay,
          maxPay: j.maxPay,
          titles: new Set()
        };
      }
      const g = groups[key];
      g.fte += j.fte;
      if (j.title) g.titles.add(j.title);
      g.minPay = Math.min(g.minPay, j.minPay);
      g.maxPay = Math.max(g.maxPay, j.maxPay);
    });

    return Object.values(groups)
      .map(g => ({
        ...g,
        titles: Array.from(g.titles).join(', '),
        fte: parseFloat(g.fte.toFixed(1))
      }))
      .sort((a, b) => b.fte - a.fte);
  }, [selectedNode]);

  // Aggregate totals for junior breakdown
  const juniorSummary = useMemo(() => {
    if (!selectedNode || !selectedNode.juniorReports) return { totalFte: 0, professions: 0, regions: 0 };
    const pSet = new Set();
    const rSet = new Set();
    let totalFte = 0;
    
    selectedNode.juniorReports.forEach(j => {
      totalFte += j.fte;
      pSet.add(j.profession);
      rSet.add(j.region);
    });

    return {
      totalFte: parseFloat(totalFte.toFixed(1)),
      professionsCount: pSet.size,
      regionsCount: rSet.size
    };
  }, [selectedNode]);

  if (!selectedNode) return null;

  const namesLabel = selectedNode.names.join(' & ') || 'Vacant Post';
  const isVacant = selectedNode.names.includes('Vacant');
  const isND = selectedNode.names.includes('N/D');

  return (
    <>
      {/* Backdrop overlay to dim the visualization and serve as a modal backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 fade-in cursor-pointer"
      />
      <div className="absolute top-0 right-0 bottom-0 w-full max-w-lg md:max-w-xl bg-[#0b0f19]/95 light:bg-white/95 backdrop-blur-2xl border-l border-white/[0.08] light:border-black/[0.08] flex flex-col z-50 shadow-2xl transition-all duration-300 transform translate-x-0 fade-in select-none">
      
      {/* Drawer Header */}
      <div className="p-5 border-b border-white/[0.06] light:border-black/[0.06] flex items-center justify-between shrink-0 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-white/[0.05] text-slate-400 font-mono font-bold uppercase">
            ID: {selectedNode.id}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-white/[0.05] text-slate-400 font-bold font-mono">
            {selectedNode.grades[0] || 'SCS'}
          </span>
        </div>
        <button 
          onClick={onClose} 
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Drawer Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        
        {/* Main Profile Panel */}
        <div className="flex flex-col gap-2 border-b border-white/[0.04] pb-6">
          <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest">HMRC Executive Profile</div>
          
          <h2 className={`text-2xl font-black font-outfit tracking-tight mt-1 ${
            isVacant ? 'text-red-400 italic' : isND ? 'text-slate-400 font-semibold' : 'text-slate-100 light:text-slate-950'
          }`}>
            {namesLabel}
          </h2>
          
          <div className="text-sm font-semibold text-cyan-400/90 light:text-cyan-600 mt-1">
            {selectedNode.jobTitles.join(' / ')}
          </div>
          
          {selectedNode.functions.length > 0 && (
            <div className="text-xs text-slate-400 light:text-slate-500 italic mt-1.5">
              "{selectedNode.functions.join(' / ')}"
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 mt-3">
            <span className={`text-[10px] font-semibold border rounded-lg px-2.5 py-1 ${getDeptColorClass(selectedNode.unit)}`}>
              📂 {selectedNode.unit}
            </span>
            <span className="text-[10px] font-semibold border border-white/[0.04] rounded-lg px-2.5 py-1 bg-white/[0.02] text-slate-300">
              👥 {selectedNode.fte} Senior FTE
            </span>
          </div>
        </div>

        {/* Dynamic Management Path timeline */}
        {selectedNode.path && selectedNode.path.length > 1 && (
          <div className="flex flex-col gap-3 bg-slate-950/20 border border-white/[0.03] p-4 rounded-2xl shadow-md">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={12} className="text-cyan-400" /> Management Reporting Chain
            </h4>
            <div className="flex flex-col relative pl-4 border-l border-white/5 gap-4 mt-2">
              {selectedNode.path.map((step, idx) => (
                <div key={step.id} className="relative flex flex-col items-start gap-0.5 group">
                  {/* Timeline dot */}
                  <span className={`absolute -left-[20.5px] top-1 w-2.5 h-2.5 rounded-full border ${
                    step.id === selectedNode.id 
                      ? 'bg-cyan-500 border-cyan-400 active-pulse scale-110 shadow-[0_0_10px_#06b6d4]' 
                      : 'bg-slate-900 border-white/20'
                  }`} />
                  
                  <button
                    onClick={() => step.id !== selectedNode.id && onSelectReport(step.id)}
                    className={`text-[11px] font-bold text-left hover:text-cyan-400 transition flex items-center gap-1 leading-none ${
                      step.id === selectedNode.id ? 'text-cyan-400 font-extrabold cursor-default pointer-events-none' : 'text-slate-300 light:text-slate-700'
                    }`}
                  >
                    {step.label}
                    {step.id !== selectedNode.id && <ArrowUpRight size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>
                  <span className="text-[9px] text-slate-500 font-mono">
                    ID: {step.id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-950/30 border border-white/[0.03] p-3 rounded-xl flex items-center gap-3">
            <Mail size={16} className="text-slate-500 shrink-0" />
            <div className="truncate min-w-0">
              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Contact Email</div>
              <a 
                href={`mailto:${selectedNode.emails[0]}`} 
                className="text-[11px] font-bold text-slate-300 hover:text-cyan-400 font-mono truncate block"
              >
                {selectedNode.emails[0] || 'contactUs@hmrc.gov.uk'}
              </a>
            </div>
          </div>

          <div className="bg-slate-950/30 border border-white/[0.03] p-3 rounded-xl flex items-center gap-3">
            <Phone size={16} className="text-slate-500 shrink-0" />
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Phone Support</div>
              <span className="text-[11px] font-bold text-slate-300 font-mono block">
                0300 200 3300
              </span>
            </div>
          </div>
        </div>

        {/* Pay Floor & Ceiling breakdown */}
        {selectedNode.payFloor !== null && (
          <div className="bg-slate-950/20 border border-white/[0.03] p-4 rounded-2xl flex flex-col gap-2.5 shadow-md">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SCS Salary Band</h4>
            <div className="flex justify-between items-center gap-4">
              <div className="flex-1 flex flex-col bg-slate-950/40 p-2.5 rounded-xl text-center border border-white/[0.02]">
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Pay Floor</span>
                <span className="text-sm font-black text-slate-200 font-mono mt-0.5">
                  £{selectedNode.payFloor.toLocaleString()}
                </span>
              </div>
              <div className="flex-1 flex flex-col bg-slate-950/40 p-2.5 rounded-xl text-center border border-white/[0.02]">
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Pay Ceiling</span>
                <span className="text-sm font-black text-slate-200 font-mono mt-0.5">
                  £{selectedNode.payCeiling.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Direct Senior Reports Section */}
        {selectedNode.children && selectedNode.children.length > 0 && (
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Direct SCS Reports ({selectedNode.children.length})
            </h4>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {selectedNode.children.map(child => (
                <button
                  key={child.id}
                  onClick={() => onSelectReport(child.id)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950/30 hover:bg-white/[0.04] border border-white/[0.03] text-left transition group"
                >
                  <div className="truncate pr-4 min-w-0">
                    <div className="text-[11px] font-bold text-slate-200 truncate group-hover:text-cyan-400 transition">
                      {child.names.join(' / ') || 'Vacant Post'}
                    </div>
                    <div className="text-[9.5px] text-slate-400 truncate mt-0.5">
                      {child.jobTitles[0] || 'Leader'}
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/10 shrink-0">
                    {child.id}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Direct Junior Reports Details */}
        {juniorBreakdown.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-end">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Junior Operational Team Details
              </h4>
              <span className="text-[10px] font-bold text-cyan-400 font-mono">
                {juniorSummary.totalFte.toLocaleString()} FTE Total
              </span>
            </div>

            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1 border border-white/[0.03] rounded-2xl bg-slate-950/20 p-3 shadow-md">
              {juniorBreakdown.map((j, idx) => (
                <div key={idx} className="flex flex-col border-b border-white/[0.03] last:border-0 pb-3 last:pb-0 gap-1.5 text-xs">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-200 font-outfit text-xs">
                      {j.grade}
                    </span>
                    <span className="text-[11px] font-bold text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/10 px-1.5 py-0.5 rounded">
                      {j.fte.toLocaleString()} FTE
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-400 mt-0.5">
                    <div className="flex items-center gap-1">
                      <Briefcase size={10} className="text-slate-500" />
                      <span className="truncate">{j.profession}</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <MapPin size={10} className="text-slate-500" />
                      <span>{j.region}</span>
                    </div>
                  </div>

                  <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                    Pay Scale Band: £{j.minPay.toLocaleString()} - £{j.maxPay.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
    </>
  );
}
