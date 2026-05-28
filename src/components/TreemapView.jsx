import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { ChevronRight, ArrowLeft } from 'lucide-react';

export default function TreemapView({ 
  data, 
  sizeMetric, 
  regionFilter, 
  professionFilter, 
  onSelectNode,
  selectedNodeId 
}) {
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  
  // Track the current node we are zoomed into
  const [zoomNodeId, setZoomNodeId] = useState('OD101');

  // Breadcrumbs for navigating up zoomed nodes
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: 'OD101', name: 'HMRC Root' }]);

  // Reset zoom when filters change
  useEffect(() => {
    setZoomNodeId('OD101');
    setBreadcrumbs([{ id: 'OD101', name: 'HMRC Root' }]);
  }, [regionFilter, professionFilter]);

  // Build a map of all senior nodes for quick lookups
  const nodesMap = useMemo(() => {
    if (!data) return {};
    const map = {};
    function traverse(n) {
      map[n.id] = n;
      if (n.children) n.children.forEach(traverse);
    }
    traverse(data);
    return map;
  }, [data]);

  // Color scheme based on top-level unit/department
  const getDeptColorInfo = (node) => {
    // Find top-level department
    const unitName = (node.unit || '').toLowerCase();
    
    let hue = 220; // Default slate
    let label = 'Other / Permanent Sec';
    
    if (unitName.includes('customer services') || unitName.includes('benefits')) {
      hue = 200; // Sky blue
      label = 'Customer Services';
    } else if (unitName.includes('compliance') || unitName.includes('fraud') || unitName.includes('large business')) {
      hue = 340; // Rose/Pink
      label = 'Customer Compliance';
    } else if (unitName.includes('strategy') || unitName.includes('tax design') || unitName.includes('indirect tax') || unitName.includes('policy')) {
      hue = 280; // Violet/Purple
      label = 'Customer Strategy & Tax Design';
    } else if (unitName.includes('digital') || unitName.includes('information') || unitName.includes('cdio') || unitName.includes('ddit')) {
      hue = 160; // Mint/Emerald
      label = 'CDIO (Digital & Tech)';
    } else if (unitName.includes('finance') || unitName.includes('cfo')) {
      hue = 45; // Amber
      label = 'Chief Finance Officer Group';
    } else if (unitName.includes('people') || unitName.includes('place') || unitName.includes('hr')) {
      hue = 15; // Coral/Orange
      label = 'People & Place (HR)';
    } else if (unitName.includes('border') || unitName.includes('trade') || unitName.includes('customs')) {
      hue = 190; // Cyan
      label = 'Borders & Trade';
    } else if (unitName.includes('transformation') || unitName.includes('enterprise')) {
      hue = 300; // Magenta
      label = 'Enterprise Transformation';
    } else if (unitName.includes('change') || unitName.includes('delivery group')) {
      hue = 250; // Purple-Blue
      label = 'Change Delivery Group';
    } else if (unitName.includes('legal') || unitName.includes('solicitor')) {
      hue = 120; // Green
      label = 'Legal Group';
    }
    
    return { hue, label };
  };

  // Main rendering engine
  useEffect(() => {
    if (!data || !containerRef.current) return;
    
    const container = d3.select(containerRef.current);
    container.selectAll('*').remove(); // Clear previous drawing
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    if (width === 0 || height === 0) return;

    // Create the tooltip
    const tooltip = d3.select(tooltipRef.current);

    // Get active zoomed subtree
    const activeSubtree = nodesMap[zoomNodeId] || data;

    // 1. Build D3 Hierarchy
    const root = d3.hierarchy(activeSubtree);

    // 2. Compute sizing values with filter logic
    root.sum(node => {
      // Sizing metric selector
      const isSalary = sizeMetric === 'salaryCost';
      
      // Calculate direct senior value matching filters
      let seniorVal = 0;
      let matchesSenior = true;
      
      if (regionFilter !== 'All' && !node.regions.includes(regionFilter)) matchesSenior = false;
      if (professionFilter !== 'All' && !node.professions.includes(professionFilter)) matchesSenior = false;
      
      if (matchesSenior) {
        if (isSalary) {
          // If we have floor/ceiling pay, use average, else direct salaryCost field, else estimate from SCS grade
          const payAvg = node.payFloor && node.payCeiling ? (node.payFloor + node.payCeiling) / 2 : 110000;
          seniorVal = payAvg * node.fte;
        } else {
          seniorVal = node.fte; // senior FTE
        }
      }

      // Calculate direct junior value matching filters
      let juniorVal = 0;
      node.juniorReports.forEach(j => {
        let matchesJunior = true;
        if (regionFilter !== 'All' && j.region !== regionFilter) matchesJunior = false;
        if (professionFilter !== 'All' && j.profession !== professionFilter) matchesJunior = false;
        
        if (matchesJunior) {
          if (isSalary) {
            const payAvg = (j.minPay + j.maxPay) / 2;
            juniorVal += payAvg * j.fte;
          } else {
            juniorVal += j.fte;
          }
        }
      });

      return seniorVal + juniorVal;
    });

    // 3. Generate Treemap Layout
    d3.treemap()
      .size([width, height])
      .paddingOuter(3)
      .paddingTop(28) // Expands spacing to give parent labels dedicated space
      .paddingInner(4)
      .round(true)(root);

    // 4. Render SVG
    const svg = container
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'w-full h-full text-slate-100 select-none')
      .style('overflow', 'visible');

    // Filter nodes with zero value or negative sizes
    const cells = root.descendants().filter(d => d.value > 0 && d.depth > 0);

    // 5. Draw ALL cell rectangles first
    svg
      .selectAll('rect.treemap-node-rect')
      .data(cells)
      .enter()
      .append('rect')
      .attr('class', 'treemap-node-rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', d => {
        const { hue } = getDeptColorInfo(d.data);
        const opacity = d.depth === 1 ? 0.8 : 0.45;
        const lightMode = document.documentElement.classList.contains('light');
        const saturation = lightMode ? '75%' : '65%';
        const lightness = lightMode ? '48%' : '32%';
        return `hsla(${hue}, ${saturation}, ${lightness}, ${opacity})`;
      })
      .attr('stroke', d => {
        const { hue } = getDeptColorInfo(d.data);
        if (d.data.id === selectedNodeId) return 'var(--accent-primary)'; // Highlight cyan
        return `hsla(${hue}, 80%, 65%, 0.25)`;
      })
      .attr('stroke-width', d => (d.data.id === selectedNodeId ? 2.5 : 1))
      .on('mouseenter', (event, d) => {
        const { label } = getDeptColorInfo(d.data);
        const formatVal = sizeMetric === 'salaryCost'
          ? `£${(d.value / 1e6).toFixed(2)}M budget`
          : `${d.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} FTE`;
        
        let detailsHtml = `
          <div class="font-sans">
            <div class="flex items-center justify-between gap-3 mb-1">
              <span class="font-bold text-slate-100 text-sm font-outfit truncate max-w-[170px]">
                ${d.data.names.join(' / ') || 'Vacant Post'}
              </span>
              <span class="text-[10px] bg-slate-800 text-cyan-400 px-1.5 py-0.5 rounded font-mono font-bold">
                ${d.data.id}
              </span>
            </div>
            <div class="text-[11px] font-semibold text-slate-200 truncate mb-1">
              ${d.data.jobTitles[0] || 'Director / Leader'}
            </div>
            <div class="text-[10px] text-cyan-400 font-medium truncate mb-2">
              📂 ${label} • ${d.data.unit}
            </div>
            <div class="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-white/[0.04]">
              <span class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Active Value</span>
              <span class="text-xs font-bold text-slate-200 font-mono">${formatVal}</span>
            </div>
            ${d.data.children && d.data.children.length > 0 ? `
              <div class="mt-2 text-[9px] text-slate-400 text-center flex items-center justify-center gap-1">
                ⚡ Click to zoom down • Double click to view details
              </div>
            ` : `
              <div class="mt-2 text-[9px] text-slate-400 text-center">
                ⚡ Click to select & view details
              </div>
            `}
          </div>
        `;
        
        tooltip
          .html(detailsHtml)
          .classed('visible', true);
      })
      .on('mousemove', (event) => {
        const tWidth = tooltipRef.current.clientWidth;
        const tHeight = tooltipRef.current.clientHeight;
        const xOffset = event.clientX + tWidth + 15 > window.innerWidth ? -tWidth - 15 : 15;
        const yOffset = event.clientY + tHeight + 15 > window.innerHeight ? -tHeight - 15 : 15;
        
        tooltip
          .style('left', `${event.clientX + xOffset}px`)
          .style('top', `${event.clientY + yOffset}px`);
      })
      .on('mouseleave', () => {
        tooltip.classed('visible', false);
      })
      .on('click', (event, d) => {
        tooltip.classed('visible', false);
        onSelectNode(d.data);
        
        // Single click zooms down if node has children
        if (d.data.children && d.data.children.length > 0) {
          setZoomNodeId(d.data.id);
          setBreadcrumbs(prev => [...prev, { id: d.data.id, name: d.data.jobTitles[0] || d.data.id }]);
        }
      });

    // 6. Draw ALL labels/foreignObjects on top of rectangles to prevent any overlapping fills
    svg
      .selectAll('foreignObject.treemap-label')
      .data(cells)
      .enter()
      .append('foreignObject')
      .attr('class', 'treemap-label')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => {
        // Parent nodes labels are constrained to the 28px paddingTop band
        const hasChildren = d.data.children && d.data.children.length > 0;
        return hasChildren ? 28 : Math.max(0, d.y1 - d.y0);
      })
      .style('pointer-events', 'none')
      .html(d => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        const hasChildren = d.data.children && d.data.children.length > 0;

        const name = d.data.names[0] || 'Vacant';
        const title = d.data.jobTitles[0] || 'Leader';
        const formatVal = sizeMetric === 'salaryCost'
          ? `£${(d.value / 1e6).toFixed(1)}M`
          : `${Math.round(d.value)} FTE`;

        if (hasChildren) {
          if (w < 85) return ''; // Too narrow to show header details
          return `
            <div style="
              width: 100%;
              height: 100%;
              padding: 4px 8px;
              box-sizing: border-box;
              display: flex;
              align-items: center;
              gap: 6px;
              font-family: 'Outfit', sans-serif;
              color: #ffffff;
              overflow: hidden;
              white-space: nowrap;
            ">
              <span style="font-weight: 700; font-size: 10px; background: rgba(255,255,255,0.12); padding: 1px 4px; border-radius: 4px;">
                ${name}
              </span>
              <span style="font-weight: 500; font-size: 9px; opacity: 0.8; text-overflow: ellipsis; overflow: hidden;">
                ${title}
              </span>
            </div>
          `;
        }

        if (w < 45 || h < 25) return ''; // Too small to show anything

        return `
          <div style="
            width: 100%;
            height: 100%;
            padding: 8px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: flex-start;
            font-family: 'Inter', sans-serif;
            overflow: hidden;
            color: #ffffff;
            line-height: 1.25;
          ">
            <div style="
              font-family: 'Outfit', sans-serif;
              font-weight: 700;
              font-size: ${w > 120 ? '11px' : '9px'};
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
            ">
              ${name}
            </div>
            ${h > 45 && w > 75 ? `
              <div style="
                font-size: 8px;
                font-weight: 500;
                opacity: 0.75;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                margin-top: 1px;
              ">
                ${title}
              </div>
            ` : ''}
            ${h > 60 && w > 70 ? `
              <div style="
                font-size: 8.5px;
                font-weight: 700;
                font-family: 'JetBrains Mono', monospace;
                color: #22d3ee;
                margin-top: auto;
              ">
                ${formatVal}
              </div>
            ` : ''}
          </div>
        `;
      });

  }, [data, sizeMetric, regionFilter, professionFilter, zoomNodeId, selectedNodeId]);

  const handleZoomOut = () => {
    if (breadcrumbs.length <= 1) return;
    const nextBreadcrumbs = [...breadcrumbs];
    nextBreadcrumbs.pop(); // remove current
    const parentNode = nextBreadcrumbs[nextBreadcrumbs.length - 1];
    setBreadcrumbs(nextBreadcrumbs);
    setZoomNodeId(parentNode.id);
  };

  const handleBreadcrumbClick = (crumbId, index) => {
    if (index === breadcrumbs.length - 1) return;
    setBreadcrumbs(prev => prev.slice(0, index + 1));
    setZoomNodeId(crumbId);
  };

  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden">
      {/* Zoom Navigation & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 select-none">
        
        {/* Zoom Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs bg-slate-900/50 light:bg-slate-200/50 border border-white/[0.04] px-3.5 py-2 rounded-xl shadow-md">
          {breadcrumbs.length > 1 && (
            <button
              onClick={handleZoomOut}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold transition mr-2 pr-2 border-r border-white/10"
            >
              <ArrowLeft size={13} /> Zoom Out
            </button>
          )}
          
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              {idx > 0 && <ChevronRight size={12} className="text-slate-500" />}
              <button
                onClick={() => handleBreadcrumbClick(crumb.id, idx)}
                className={`transition font-semibold truncate max-w-[120px] ${
                  idx === breadcrumbs.length - 1
                    ? 'text-slate-100 light:text-slate-900 font-bold cursor-default'
                    : 'text-slate-400 hover:text-slate-200 light:hover:text-slate-600'
                }`}
              >
                {crumb.name.length > 15 ? crumb.name.slice(0, 15) + '...' : crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Legend */}
        <div className="glass-panel border border-white/[0.04] px-4 py-2 rounded-xl flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider shadow-md">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-sky-500/70 border border-sky-400/40"></span>
            <span className="text-slate-400">Customer Services</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-500/70 border border-rose-400/40"></span>
            <span className="text-slate-400">Compliance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-violet-500/70 border border-violet-400/40"></span>
            <span className="text-slate-400">Tax Strategy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500/70 border border-emerald-400/40"></span>
            <span className="text-slate-400">CDIO (Tech)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-cyan-500/70 border border-cyan-400/40"></span>
            <span className="text-slate-400">Borders</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-slate-500/70 border border-slate-400/40"></span>
            <span className="text-slate-400">Support Group</span>
          </div>
        </div>
      </div>

      {/* D3 Render Container */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full rounded-2xl glass-panel border border-white/[0.04] bg-slate-950/20 shadow-2xl relative overflow-hidden"
      >
        {/* D3 builds SVG elements directly in this div */}
      </div>

      {/* Custom Tooltip */}
      <div ref={tooltipRef} className="treemap-tooltip" />
    </div>
  );
}
