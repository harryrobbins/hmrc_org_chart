import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, Maximize2, Users, GitFork } from 'lucide-react';

export default function OrgTreeView({ data, regionFilter, professionFilter, onSelectNode, selectedNode }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const gRef = useRef(null);
  
  // Track d3 zoom behavior reference to trigger button actions
  const zoomBehaviorRef = useRef(null);

  // Department color mappings
  const getDeptHue = (unit) => {
    const unitName = (unit || '').toLowerCase();
    if (unitName.includes('customer services') || unitName.includes('benefits')) return 200; // Blue
    if (unitName.includes('compliance') || unitName.includes('fraud') || unitName.includes('large business')) return 340; // Rose
    if (unitName.includes('strategy') || unitName.includes('tax design') || unitName.includes('policy')) return 280; // Violet
    if (unitName.includes('digital') || unitName.includes('cdio') || unitName.includes('ddit')) return 160; // Teal
    if (unitName.includes('finance') || unitName.includes('cfo')) return 45; // Amber
    if (unitName.includes('people') || unitName.includes('place') || unitName.includes('hr')) return 15; // Orange
    if (unitName.includes('border') || unitName.includes('trade')) return 190; // Cyan
    if (unitName.includes('transformation') || unitName.includes('enterprise')) return 300; // Magenta
    if (unitName.includes('change') || unitName.includes('delivery')) return 250; // Purple-Blue
    return 220; // Slate
  };

  // We load the data once and maintain a local mutable copy of the tree with collapse states.
  const [treeData, setTreeData] = useState(null);

  useEffect(() => {
    if (!data) return;
    // Deep clone raw data so we don't pollute the global store with D3 local variables
    const clone = JSON.parse(JSON.stringify(data));
    
    // Pre-collapse deep nodes (below depth 2) so the tree is readable initially
    function collapseDeep(node, depth = 0) {
      if (depth >= 2 && node.children && node.children.length > 0) {
        node._children = node.children;
        node.children = null;
      }
      if (node.children) {
        node.children.forEach(c => collapseDeep(c, depth + 1));
      }
      if (node._children) {
        node._children.forEach(c => collapseDeep(c, depth + 1));
      }
    }
    
    collapseDeep(clone);
    setTreeData(clone);
  }, [data]);

  // Focus and auto-expand nodes selected via global search
  useEffect(() => {
    if (!selectedNode || !treeData) return;
    
    let modified = false;
    
    // Recursive helper to expand all ancestors of selectedNode.id
    function expandToNode(node, targetId) {
      if (node.id === targetId) return true;
      
      // Look in currently visible children
      if (node.children) {
        for (let child of node.children) {
          if (expandToNode(child, targetId)) return true;
        }
      }
      
      // Look in collapsed children
      if (node._children) {
        for (let child of node._children) {
          if (expandToNode(child, targetId)) {
            // Expand parent!
            node.children = node._children;
            node._children = null;
            modified = true;
            return true;
          }
        }
      }
      return false;
    }

    expandToNode(treeData, selectedNode.id);

    if (modified) {
      // Trigger re-render by cloning treeData
      setTreeData({ ...treeData });
    }
  }, [selectedNode, treeData]);

  // D3 Tree rendering engine
  useEffect(() => {
    if (!treeData || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width === 0 || height === 0) return;

    // Card sizes
    const cardW = 220;
    const cardH = 75;
    
    // Clear old drawings
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g').attr('class', 'tree-viewport');
    gRef.current = g.node();

    // 1. Set up D3 Zoom & Pan
    const zoom = d3.zoom()
      .scaleExtent([0.1, 2.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
      
    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Initial position: centered horizontally, slightly down
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2 - cardW / 2, 80).scale(0.75));

    // 2. Set up tree layout
    const treeLayout = d3.tree()
      .nodeSize([cardW + 40, cardH + 70]); // spacing between cards

    const root = d3.hierarchy(treeData);

    // Assign positions
    treeLayout(root);

    // 3. Draw Links (curved Beziers stepping vertically)
    const linkGenerator = d3.linkVertical()
      .x(d => d.x + cardW / 2)
      .y(d => d.y + cardH / 2);

    // Draw lines
    g.append('g')
      .attr('class', 'links-group')
      .selectAll('path')
      .data(root.links())
      .enter()
      .append('path')
      .attr('d', d => {
        // Draw elegant orthogonal bezier links
        const sourceX = d.source.x + cardW / 2;
        const sourceY = d.source.y + cardH;
        const targetX = d.target.x + cardW / 2;
        const targetY = d.target.y;
        const midY = (sourceY + targetY) / 2;
        return `M${sourceX},${sourceY} 
                C${sourceX},${midY} 
                 ${targetX},${midY} 
                 ${targetX},${targetY}`;
      })
      .attr('class', 'link-line')
      .attr('stroke', d => {
        const hue = getDeptHue(d.source.data.unit);
        return `hsla(${hue}, 60%, 55%, 0.28)`;
      })
      .attr('fill', 'none')
      .attr('stroke-width', 2);

    // 4. Render Nodes
    const nodes = g.append('g')
      .attr('class', 'nodes-group')
      .selectAll('g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Outer card body
    const cards = nodes.append('g')
      .attr('class', 'cursor-pointer')
      .on('click', (event, d) => {
        // Prevent trigger during zoom clicks
        if (event.defaultPrevented) return;
        onSelectNode(d.data);
      });

    // Use foreignObject to draw gorgeous, high-fidelity HTML cards instead of raw SVG rects and texts!
    cards.append('foreignObject')
      .attr('width', cardW)
      .attr('height', cardH)
      .html(d => {
        const isSelected = selectedNode && d.data.id === selectedNode.id;
        const hue = getDeptHue(d.data.unit);
        const nameStr = d.data.names.join(' / ') || 'Vacant Post';
        const titleStr = d.data.jobTitles[0] || 'Leader';
        const unit = d.data.unit || 'Other';
        const truncatedName = nameStr.length > 25 ? nameStr.slice(0, 23) + '...' : nameStr;
        const truncatedTitle = titleStr.length > 28 ? titleStr.slice(0, 26) + '...' : titleStr;
        const truncatedUnit = unit.length > 30 ? unit.slice(0, 28) + '...' : unit;

        const borderStyle = isSelected
          ? 'border: 1.5px solid var(--accent-primary); box-shadow: 0 0 15px rgba(6, 182, 212, 0.25);'
          : 'border: 1px solid rgba(255, 255, 255, 0.06); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);';

        const topColor = `hsl(${hue}, 85%, 50%)`;
        const badgeColor = `hsl(${hue}, 85%, 65%)`;

        return `
          <div style="
            width: 100%;
            height: 100%;
            border-radius: 10px;
            background: #0d1222;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
            font-family: 'Inter', sans-serif;
            ${borderStyle}
          ">
            <!-- Top Color Stripe -->
            <div style="
              width: 100%;
              height: 4px;
              background-color: ${topColor};
            "></div>

            <!-- Content Area -->
            <div style="
              padding: 8px 10px;
              display: flex;
              flex-direction: column;
              flex-grow: 1;
              justify-content: space-between;
            ">
              <!-- Name & ID -->
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div style="
                  font-family: 'Outfit', sans-serif;
                  font-weight: 700;
                  font-size: 11px;
                  color: #f8fafc;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  max-width: 145px;
                ">
                  ${truncatedName}
                </div>
                <div style="
                  font-family: 'JetBrains Mono', monospace;
                  font-size: 7px;
                  font-weight: 700;
                  color: #64748b;
                  background: rgba(255, 255, 255, 0.05);
                  padding: 1px 4px;
                  border-radius: 3px;
                ">
                  ${d.data.id}
                </div>
              </div>

              <!-- Title & Unit -->
              <div style="margin-top: 1px;">
                <div style="
                  font-size: 9px;
                  font-weight: 500;
                  color: #94a3b8;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  max-width: 190px;
                ">
                  ${truncatedTitle}
                </div>
                <div style="
                  font-size: 8px;
                  font-weight: 600;
                  color: ${badgeColor};
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  max-width: 190px;
                  margin-top: 1px;
                ">
                  ${truncatedUnit}
                </div>
              </div>

              <!-- Headcount Rollup -->
              <div style="
                display: flex;
                align-items: center;
                gap: 4px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 8px;
                font-weight: 700;
                color: #22d3ee;
                background: rgba(6, 182, 212, 0.06);
                border: 0.5px solid rgba(6, 182, 212, 0.15);
                padding: 2px 6px;
                border-radius: 4px;
                width: max-content;
                margin-top: 2px;
              ">
                <span>👥 ${d.data.rollupFte.toLocaleString()} FTE</span>
              </div>
            </div>
          </div>
        `;
      });

    // Expand / Collapse Circular Button
    const collapseTrigger = nodes.filter(d => (d.data.children && d.data.children.length > 0) || d.data._children)
      .append('g')
      .attr('transform', `translate(${cardW / 2}, ${cardH})`)
      .attr('class', 'cursor-pointer select-none')
      .on('click', (event, d) => {
        event.stopPropagation(); // Avoid selecting node card
        toggleNodeCollapse(d.data);
      });

    collapseTrigger.append('circle')
      .attr('r', 8)
      .attr('fill', '#1e293b')
      .attr('stroke', 'rgba(255, 255, 255, 0.15)')
      .attr('stroke-width', 1);

    // Draw the + or - inside the expand toggle
    collapseTrigger.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '2.5px')
      .attr('fill', '#94a3b8')
      .style('font-size', '9px')
      .style('font-weight', 'bold')
      .text(d => (d.data.children ? '−' : '+'));

    // Pan to center selected node transition
    if (selectedNode) {
      const targetNode = root.descendants().find(d => d.data.id === selectedNode.id);
      if (targetNode) {
        const transX = width / 2 - (targetNode.x + cardW / 2) * 0.9;
        const transY = height / 2 - (targetNode.y + cardH / 2) * 0.9;
        
        svg.transition()
          .duration(750)
          .call(
            zoom.transform,
            d3.zoomIdentity.translate(transX, transY).scale(0.9)
          );
      }
    }

  }, [treeData, selectedNode]);

  // Click handler to toggle expansion in local state
  const toggleNodeCollapse = (node) => {
    if (node.children) {
      node._children = node.children;
      node.children = null;
    } else {
      node.children = node._children;
      node._children = null;
    }
    // Force re-render of local state clone
    setTreeData({ ...treeData });
  };

  // Button actions for overlay controls
  const handleZoomIn = () => {
    if (!zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(200)
      .call(zoomBehaviorRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(200)
      .call(zoomBehaviorRef.current.scaleBy, 0.7);
  };

  const handleResetFit = () => {
    if (!zoomBehaviorRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(
        zoomBehaviorRef.current.transform, 
        d3.zoomIdentity.translate(width / 2 - 110, 80).scale(0.75)
      );
  };

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden">
      {/* Zoom / Navigation overlay controls (bottom right) */}
      <div className="absolute right-4 bottom-16 z-30 flex flex-col gap-2 shadow-2xl select-none">
        <button
          onClick={handleZoomIn}
          className="p-2.5 rounded-xl glass-panel border border-white/[0.06] hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 transition"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2.5 rounded-xl glass-panel border border-white/[0.06] hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 transition"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={handleResetFit}
          className="p-2.5 rounded-xl glass-panel border border-white/[0.06] hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 transition"
          title="Reset Fit"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* SVG Canvas Container */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full h-full bg-[#080b12] light:bg-[#f8fafc] overflow-hidden"
      >
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  );
}
