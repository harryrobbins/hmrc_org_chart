import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Network, 
  LayoutGrid, 
  BarChart3, 
  Search, 
  X, 
  Sun, 
  Moon, 
  Users, 
  PiggyBank, 
  Building2, 
  MapPin, 
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import TreemapView from './components/TreemapView';
import OrgTreeView from './components/OrgTreeView';
import AnalyticsView from './components/AnalyticsView';
import SidebarDrawer from './components/SidebarDrawer';

export default function App() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Tab routing: 'treemap' | 'orgchart' | 'analytics'
  const [activeTab, setActiveTab] = useState('treemap');
  
  // Global Filters & Controls
  const [theme, setTheme] = useState('dark');
  const [sizeMetric, setSizeMetric] = useState('rollupFte'); // 'rollupFte' | 'salaryCost'
  const [regionFilter, setRegionFilter] = useState('All');
  const [professionFilter, setProfessionFilter] = useState('All');
  
  // Node selection for details drawer
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Load Data
  useEffect(() => {
    fetch('./hmrc-data.json')
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch organogram data!");
        return res.json();
      })
      .then(json => {
        setData(json);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("DataLoader error:", err);
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  // Theme Toggler
  useEffect(() => {
    const rootEl = document.documentElement;
    if (theme === 'light') {
      rootEl.classList.add('light');
    } else {
      rootEl.classList.remove('light');
    }
  }, [theme]);

  // Click outside search container to close results dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Flatten the tree into an array for easy searching, filtering, and indexing
  const flatNodesList = useMemo(() => {
    if (!data) return [];
    const list = [];
    
    function traverse(node, path = []) {
      const currentPath = [...path, { id: node.id, label: node.jobTitles[0] || node.id }];
      list.push({
        ...node,
        path: currentPath,
        searchStr: `${node.id} ${node.names.join(' ')} ${node.jobTitles.join(' ')} ${node.unit}`.toLowerCase()
      });
      if (node.children && node.children.length > 0) {
        node.children.forEach(c => traverse(c, currentPath));
      }
    }
    
    traverse(data);
    return list;
  }, [data]);

  // Build unique lists for dropdown filters
  const { regions, professions } = useMemo(() => {
    if (flatNodesList.length === 0) return { regions: [], professions: [] };
    const rSet = new Set();
    const pSet = new Set();
    
    flatNodesList.forEach(node => {
      // Direct senior region/profession
      node.regions.forEach(r => rSet.add(r));
      node.professions.forEach(p => pSet.add(p));
      
      // Junior regions/professions
      node.juniorReports.forEach(j => {
        rSet.add(j.region);
        pSet.add(j.profession);
      });
    });
    
    return {
      regions: ['All', ...Array.from(rSet).filter(r => r && r !== 'nan' && r !== 'Unknown').sort()],
      professions: ['All', ...Array.from(pSet).filter(p => p && p !== 'Other').sort()]
    };
  }, [flatNodesList]);

  // Filtered search results
  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return flatNodesList
      .filter(n => n.searchStr.includes(query))
      .slice(0, 10); // cap results at 10 for performance & UX
  }, [searchQuery, flatNodesList]);

  // Top level aggregate metrics
  const stats = useMemo(() => {
    if (!data) return { totalFte: 0, seniorCount: 0, juniorFte: 0 };
    return {
      totalFte: data.rollupFte || 0,
      seniorCount: flatNodesList.length,
      juniorFte: (data.rollupFte || 0) - flatNodesList.length
    };
  }, [data, flatNodesList]);

  const selectSearchedNode = (node) => {
    setSelectedNode(node);
    setSearchQuery('');
    setShowSearchResults(false);
    // If analytics view is active, switch to treemap or orgchart so user can see it!
    if (activeTab === 'analytics') {
      setActiveTab('treemap');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-slate-100 font-sans">
        <div className="relative flex items-center justify-center mb-6">
          <div className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-cyan-500 opacity-25"></div>
          <Network className="animate-spin text-cyan-400" size={48} />
        </div>
        <h2 className="text-xl font-medium tracking-tight mb-2">HMRC Org Analytics Loader</h2>
        <p className="text-sm text-slate-400">Preprocessing CSV records & resolving management paths...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-slate-100 font-sans p-6 text-center">
        <div className="text-red-500 mb-4 bg-red-500/10 p-4 rounded-full border border-red-500/20">
          <X size={48} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Failed to Load Organogram Data</h2>
        <p className="text-sm text-slate-400 mb-6 max-w-md">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 font-medium transition duration-200"
        >
          Reload Interface
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden text-slate-100 bg-[#080b12] light:bg-[#f8fafc] transition-colors duration-300">
      {/* Top Header */}
      <header className="glass-panel shrink-0 border-b border-white/[0.04] light:border-black/[0.04] px-6 py-4 flex flex-row items-center justify-between z-40 select-none shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-violet-500 p-2.5 rounded-xl shadow-lg shadow-cyan-500/10 flex items-center justify-center text-white">
            <Network size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 light:from-slate-800 light:to-slate-950 bg-clip-text text-transparent flex items-center gap-2">
              HMRC Organogram Dashboard
            </h1>
            <p className="text-xs text-slate-400 light:text-slate-500 font-medium">
              Interactive Treasury & Tax Administration Chart • March 2026 Release
            </p>
          </div>
        </div>

        {/* Search Container */}
        <div ref={searchContainerRef} className="relative w-80 max-w-xs md:w-96">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search senior officers, titles, posts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="w-full bg-slate-900/50 light:bg-slate-200/50 border border-white/[0.06] light:border-black/[0.06] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-2 pl-9 pr-8 text-sm outline-none text-slate-100 light:text-slate-900 transition-all placeholder:text-slate-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Autocomplete Results */}
          {showSearchResults && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#0e1422] light:bg-white border border-white/[0.08] light:border-black/[0.08] rounded-xl shadow-2xl overflow-hidden z-50 fade-in backdrop-blur-xl">
              {filteredSearchResults.length > 0 ? (
                <div className="py-1">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-white/[0.04]">
                    Matching Positions
                  </div>
                  {filteredSearchResults.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => selectSearchedNode(node)}
                      className="w-full px-3 py-2 flex flex-col items-start hover:bg-white/[0.04] light:hover:bg-slate-100 text-left border-b border-white/[0.02] last:border-0"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-semibold text-xs text-slate-100 light:text-slate-900 truncate max-w-[70%]">
                          {node.names.join(' / ') || 'Vacant Post'}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 font-mono">
                          {node.id}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 light:text-slate-500 truncate w-full mt-0.5">
                        {node.jobTitles.join(' / ')}
                      </span>
                      <span className="text-[9px] text-cyan-400/80 light:text-cyan-600 w-full mt-0.5 truncate flex items-center gap-1 font-medium">
                        <Building2 size={9} /> {node.unit}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-500 light:text-slate-400">
                  No matching senior posts found.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Controls & Theme */}
        <div className="flex items-center gap-4">
          {/* Tab Selection */}
          <div className="flex bg-slate-950/60 light:bg-slate-200/60 border border-white/[0.06] light:border-black/[0.06] rounded-xl p-1 shrink-0">
            <button
              onClick={() => setActiveTab('treemap')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'treemap' 
                  ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 border border-cyan-500/30 text-cyan-400' 
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <LayoutGrid size={14} />
              Treemap View
            </button>
            <button
              onClick={() => setActiveTab('orgchart')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'orgchart' 
                  ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 border border-cyan-500/30 text-cyan-400' 
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Network size={14} />
              Org Tree
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'analytics' 
                  ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 border border-cyan-500/30 text-cyan-400' 
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <BarChart3 size={14} />
              Analytics
            </button>
          </div>

          {/* Theme switcher */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl glass-card hover:bg-white/[0.06] border border-white/[0.06] light:border-black/[0.06] text-slate-400 hover:text-slate-200"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1 w-full flex flex-row overflow-hidden relative">
        {/* Visualizer Area */}
        <div className="flex-1 h-full flex flex-col overflow-hidden relative">
          
          {/* Quick Config Bar (Treemap metrics and Filters) */}
          <div className="relative px-6 py-3 border-b border-white/[0.04] light:border-black/[0.04] bg-slate-950/20 shrink-0 flex flex-wrap gap-3 items-center justify-between select-none">
            {activeTab === 'treemap' ? (
              <div className="glass-panel border border-white/[0.04] light:border-black/[0.04] px-3.5 py-2 rounded-xl flex items-center gap-2.5 text-xs shadow-lg">
                <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                  <SlidersHorizontal size={13} /> Metric Box Size:
                </span>
                <div className="flex bg-slate-950/50 light:bg-slate-200/50 p-0.5 rounded-lg border border-white/[0.04] light:border-black/[0.04]">
                  <button
                    onClick={() => setSizeMetric('rollupFte')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition ${
                      sizeMetric === 'rollupFte' 
                        ? 'bg-cyan-500 text-slate-950 font-black' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Staff (FTE)
                  </button>
                  <button
                    onClick={() => setSizeMetric('salaryCost')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition ${
                      sizeMetric === 'salaryCost' 
                        ? 'bg-cyan-500 text-slate-950 font-black' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Salary Cost
                  </button>
                </div>
              </div>
            ) : <div />}

            {/* General Filters */}
            <div className="glass-panel border border-white/[0.04] light:border-black/[0.04] px-4 py-2 rounded-xl flex flex-row flex-wrap items-center gap-4 text-xs shadow-lg">
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-cyan-400" />
                <span className="font-semibold text-slate-400">Region:</span>
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="bg-slate-950/50 light:bg-slate-200/50 border border-white/[0.06] light:border-black/[0.06] rounded-lg px-2.5 py-1 text-slate-200 light:text-slate-800 focus:outline-none focus:border-cyan-500 font-medium"
                >
                  {regions.map(r => <option key={r} value={r} className="bg-slate-950 text-slate-100">{r}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-1.5 border-l border-white/[0.06] pl-4">
                <Building2 size={13} className="text-cyan-400" />
                <span className="font-semibold text-slate-400">Profession:</span>
                <select
                  value={professionFilter}
                  onChange={(e) => setProfessionFilter(e.target.value)}
                  className="bg-slate-950/50 light:bg-slate-200/50 border border-white/[0.06] light:border-black/[0.06] rounded-lg px-2.5 py-1 text-slate-200 light:text-slate-800 focus:outline-none focus:border-cyan-500 font-medium"
                >
                  {professions.map(p => <option key={p} value={p} className="bg-slate-950 text-slate-100">{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Mount Active Visualization Component */}
          <div className="flex-1 h-full w-full relative">
            {activeTab === 'treemap' && (
              <TreemapView
                data={data}
                sizeMetric={sizeMetric}
                regionFilter={regionFilter}
                professionFilter={professionFilter}
                onSelectNode={(node) => setSelectedNode(node)}
                selectedNodeId={selectedNode ? selectedNode.id : null}
              />
            )}
            
            {activeTab === 'orgchart' && (
              <OrgTreeView
                data={data}
                regionFilter={regionFilter}
                professionFilter={professionFilter}
                onSelectNode={(node) => setSelectedNode(node)}
                selectedNode={selectedNode}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView
                data={data}
                flatNodes={flatNodesList}
                regionFilter={regionFilter}
                professionFilter={professionFilter}
              />
            )}
          </div>

          {/* Bottom stats overview panel */}
          {activeTab !== 'analytics' && (
            <div className="absolute bottom-4 left-4 z-20 flex gap-4 select-none pointer-events-none">
              <div className="glass-panel border border-white/[0.04] px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-lg">
                <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Users size={16} />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Staff</div>
                  <div className="text-sm font-bold text-slate-100 light:text-slate-900 font-mono">
                    {stats.totalFte.toLocaleString(undefined, { maximumFractionDigits: 0 })} FTE
                  </div>
                </div>
              </div>

              <div className="glass-panel border border-white/[0.04] px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-lg">
                <div className="bg-violet-500/10 p-2 rounded-lg border border-violet-500/20 text-violet-400 flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Senior Leaders (SCS)</div>
                  <div className="text-sm font-bold text-slate-100 light:text-slate-900 font-mono">
                    {stats.seniorCount} Posts
                  </div>
                </div>
              </div>

              <div className="glass-panel border border-white/[0.04] px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-lg">
                <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <PiggyBank size={16} />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Junior Operations Staff</div>
                  <div className="text-sm font-bold text-slate-100 light:text-slate-900 font-mono">
                    {stats.juniorFte.toLocaleString(undefined, { maximumFractionDigits: 0 })} FTE
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Deep Dive Sidebar Drawer */}
        <SidebarDrawer
          selectedNode={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSelectReport={(reportId) => {
            const node = flatNodesList.find(n => n.id === reportId);
            if (node) setSelectedNode(node);
          }}
        />
      </main>
    </div>
  );
}
