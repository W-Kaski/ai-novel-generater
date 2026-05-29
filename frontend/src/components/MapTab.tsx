// frontend/src/components/MapTab.tsx
import React, { useState, useEffect, useRef } from 'react';
import { getWorldMap, saveWorldMap } from '../api';
import { 
  Map, 
  Plus, 
  RotateCcw, 
  Compass, 
  Save, 
  PlusCircle, 
  Trash2, 
  Sparkles
} from 'lucide-react';

interface Continent {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
}

interface Faction {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  capital: string;
  influence_radius: number;
  description?: string;
}

interface City {
  id: string;
  name: string;
  x: number;
  y: number;
  faction_id: string;
  is_capital: boolean;
  size: number;
  vision_radius?: number;
}

interface MapLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  font_size: number;
  style: 'normal' | 'italic';
  color: string;
}

interface WorldMapData {
  schema_version: number;
  width: number;
  height: number;
  continents: Continent[];
  factions: Faction[];
  cities: City[];
  labels: MapLabel[];
  coastline_scale?: number;
}

interface MapTabProps {
  filepath: string;
}

// Midpoint displacement fractal coastline generator
function generateFractalPath(points: {x: number, y: number}[], iterations: number, roughness: number): string {
  let currentPoints = [...points];

  for (let iter = 0; iter < iterations; iter++) {
    const nextPoints: {x: number, y: number}[] = [];
    const scale = Math.pow(roughness, iter);

    for (let i = 0; i < currentPoints.length; i++) {
      const p1 = currentPoints[i];
      const p2 = currentPoints[(i + 1) % currentPoints.length];

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      // Perpendicular vector
      const nx = -dy / len;
      const ny = dx / len;

      const offset = (Math.random() - 0.5) * len * 0.25 * scale;
      const displacedX = midX + nx * offset;
      const displacedY = midY + ny * offset;

      nextPoints.push(p1);
      nextPoints.push({ x: displacedX, y: displacedY });
    }
    currentPoints = nextPoints;
  }

  // Build SVG path
  return 'M ' + currentPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ') + ' Z';
}

const EMPTY_MAP: WorldMapData = {
  schema_version: 1,
  width: 800,
  height: 500,
  continents: [],
  factions: [],
  cities: [],
  labels: [],
  coastline_scale: 1.0,
};

export default function MapTab({ filepath }: MapTabProps) {
  const [mapData, setMapData] = useState<WorldMapData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<{ type: 'city' | 'faction' | 'continent' | 'label', id: string } | null>(null);
  
  // Navigation State
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStart = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  // Dragging State
  const [draggedEntity, setDraggedEntity] = useState<{ type: 'city' | 'faction' | 'continent' | 'label', id: string } | null>(null);
  
  // Coastline Cache
  const [coastlinePath, setCoastlinePath] = useState<string>('');

  // Inline faction name editing in geopolitics panel
  const [editingFactionId, setEditingFactionId] = useState<string | null>(null);
  const [editingFactionName, setEditingFactionName] = useState<string>('');

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Fetch world map data on startup
  const fetchWorldMap = async () => {
    if (!filepath) return;
    setMapError(null);
    try {
      const data = await getWorldMap(filepath);
      // Validate that the JSON uses the visual editor schema
      if (!Array.isArray(data?.continents) || !Array.isArray(data?.factions) || !Array.isArray(data?.cities)) {
        setMapError('world_map.json 格式不兼容（检测到旧版叙事格式）。\n请点击下方「创建空白地图」初始化可视化地图，原文件将被覆盖。');
        return;
      }
      setMapData(data);
      setSelectedEntity(null);
    } catch (e) {
      console.error("Failed to load world map data:", e);
    }
  };

  // Generate a random rugged coastline based on continents
  const regenerateCoastline = (data?: WorldMapData) => {
    const md = data ?? mapData;
    if (!md || !Array.isArray(md.continents) || md.continents.length === 0) return;
    const scale = md.coastline_scale ?? 1.0;
    const w = md.width;
    const h = md.height;
    const cx = w / 2;
    const cy = h / 2;
    // Octagon vertices defined as fractions of map dimensions (fills ~80% of map at scale 1.0)
    const rawOctagon = [
      { x: w * 0.20, y: h * 0.48 },
      { x: w * 0.30, y: h * 0.18 },
      { x: w * 0.50, y: h * 0.08 },
      { x: w * 0.74, y: h * 0.16 },
      { x: w * 0.84, y: h * 0.44 },
      { x: w * 0.76, y: h * 0.82 },
      { x: w * 0.50, y: h * 0.92 },
      { x: w * 0.22, y: h * 0.84 },
    ].map(p => ({
      x: cx + (p.x - cx) * scale,
      y: cy + (p.y - cy) * scale
    }));
    const path = generateFractalPath(rawOctagon, 4, 0.85);
    setCoastlinePath(path);
  };

  useEffect(() => {
    fetchWorldMap();
  }, [filepath]);

  useEffect(() => {
    if (mapData && !coastlinePath) {
      regenerateCoastline(mapData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData]);

  if (mapError || !mapData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        {mapError ? (
          <>
            <div style={{ color: 'var(--color-warning)', fontSize: '0.9rem', fontWeight: 600 }}>⚠ 地图格式不兼容</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.7, maxWidth: '480px', whiteSpace: 'pre-line' }}>{mapError}</div>
            <button
              onClick={() => { setMapError(null); setMapData({ ...EMPTY_MAP }); }}
              style={{ padding: '0.5rem 1.2rem', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            >
              创建空白地图
            </button>
          </>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>正在加载奇幻大陆地图要素...</span>
        )}
      </div>
    );
  }

  // Panning & Zooming event handlers
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(prev => Math.min(3.0, Math.max(0.5, prev * zoomFactor)));
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Left click anywhere on ocean background triggers pan (entities stop propagation)
    if (e.button === 0) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y
      });
      return;
    }

    if (draggedEntity && svgRef.current) {
      const svg = svgRef.current;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      
      // Native SVG matrix transformation converting screen client coordinates to SVG user space coordinates
      const svgPoint = pt.matrixTransform(ctm.inverse());
      
      // Convert untransformed SVG coordinates to user coordinates inside the translated and zoomed group
      const userX = Math.round((svgPoint.x - pan.x) / zoom);
      const userY = Math.round((svgPoint.y - pan.y) / zoom);

      // Constrain inside bounds — expand boundary proportionally to coastline scale
      const cs = mapData.coastline_scale ?? 1.0;
      const cx = mapData.width / 2;
      const cy = mapData.height / 2;
      const f = cs + 0.05; // 5% extra margin
      const clampedX = Math.min(cx + cx * f, Math.max(cx - cx * f, userX));
      const clampedY = Math.min(cy + cy * f, Math.max(cy - cy * f, userY));

      setMapData(prev => {
        if (!prev) return null;
        const copy = { ...prev };
        if (draggedEntity.type === 'city') {
          copy.cities = copy.cities.map(c => c.id === draggedEntity.id ? { ...c, x: clampedX, y: clampedY } : c);
          // If capital is dragged, sync faction influence center coordinates
          const capitalCity = copy.cities.find(c => c.id === draggedEntity.id);
          if (capitalCity?.is_capital) {
            copy.factions = copy.factions.map(f => f.capital === capitalCity.name ? { ...f, x: clampedX, y: clampedY } : f);
          }
        } else if (draggedEntity.type === 'faction') {
          copy.factions = copy.factions.map(f => f.id === draggedEntity.id ? { ...f, x: clampedX, y: clampedY } : f);
        } else if (draggedEntity.type === 'continent') {
          copy.continents = copy.continents.map(c => c.id === draggedEntity.id ? { ...c, x: clampedX, y: clampedY } : c);
        } else if (draggedEntity.type === 'label') {
          copy.labels = copy.labels.map(l => l.id === draggedEntity.id ? { ...l, x: clampedX, y: clampedY } : l);
        }
        return copy;
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedEntity(null);
  };

  // Node Click Handlers
  const handleEntityMouseDown = (type: 'city' | 'faction' | 'continent' | 'label', id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedEntity({ type, id });
    setDraggedEntity({ type, id });
  };

  // Add geography elements
  const addCity = () => {
    const newId = `ct_${Date.now()}`;
    const newCity: City = {
      id: newId,
      name: `新城池_${mapData.cities.length + 1}`,
      x: 350 + Math.round(Math.random() * 100),
      y: 200 + Math.round(Math.random() * 100),
      faction_id: mapData.factions[0]?.id || '',
      is_capital: false,
      size: 5
    };
    setMapData(prev => prev ? { ...prev, cities: [...prev.cities, newCity] } : null);
    setSelectedEntity({ type: 'city', id: newId });
  };

  const addFaction = () => {
    const factionId = `f_${Date.now()}`;
    const cityId = `ct_${Date.now()}`;
    const randomHue = Math.round(Math.random() * 360);
    const factionColor = `hsl(${randomHue}, 75%, 50%)`;

    const newFaction: Faction = {
      id: factionId,
      name: `新势力_${mapData.factions.length + 1}`,
      x: 300 + Math.round(Math.random() * 150),
      y: 200 + Math.round(Math.random() * 150),
      color: factionColor,
      capital: `新据点_${mapData.cities.length + 1}`,
      influence_radius: 120
    };

    const newCity: City = {
      id: cityId,
      name: newFaction.capital,
      x: newFaction.x,
      y: newFaction.y,
      faction_id: factionId,
      is_capital: true,
      size: 8
    };

    setMapData(prev => prev ? { 
      ...prev, 
      factions: [...prev.factions, newFaction],
      cities: [...prev.cities, newCity]
    } : null);

    setSelectedEntity({ type: 'faction', id: factionId });
  };

  const addLabel = () => {
    const newId = `l_${Date.now()}`;
    const newLabel: MapLabel = {
      id: newId,
      text: "新标记",
      x: 200 + Math.round(Math.random() * 150),
      y: 100 + Math.round(Math.random() * 100),
      font_size: 12,
      style: "normal",
      color: "rgba(255,255,255,0.4)"
    };
    setMapData(prev => prev ? { ...prev, labels: [...prev.labels, newLabel] } : null);
    setSelectedEntity({ type: 'label', id: newId });
  };

  const deleteSelected = () => {
    if (!selectedEntity || !mapData) return;
    const { type, id } = selectedEntity;

    setMapData(prev => {
      if (!prev) return null;
      const copy = { ...prev };
      if (type === 'city') {
        const city = copy.cities.find(c => c.id === id);
        if (city?.is_capital) {
          // Deleting a capital removes the whole faction and all its cities
          copy.factions = copy.factions.filter(f => f.id !== city.faction_id);
          copy.cities = copy.cities.filter(c => c.faction_id !== city.faction_id);
        } else {
          copy.cities = copy.cities.filter(c => c.id !== id);
        }
      } else if (type === 'faction') {
        if (copy.factions.length <= 1) {
          alert("必须保留至少一个基础势力！");
          return prev;
        }
        const faction = copy.factions.find(f => f.id === id);
        copy.factions = copy.factions.filter(f => f.id !== id);
        // Delete all cities belonging to this deleted faction
        copy.cities = copy.cities.filter(c => c.faction_id !== id);
      } else if (type === 'label') {
        copy.labels = copy.labels.filter(l => l.id !== id);
      } else if (type === 'continent') {
        alert("无法删除基础大陆！");
        return prev;
      }
      return copy;
    });

    setSelectedEntity(null);
  };

  // Committing saves
  const handleSaveMap = async () => {
    try {
      await saveWorldMap({ filepath, map_data: mapData });
      alert("奇幻势力疆域图已成功保存！");
    } catch (e) {
      alert("地图保存失败，请检查网络或后端状态！");
    }
  };

  const activeEntity = (() => {
    if (!selectedEntity || !mapData) return null;
    const { type, id } = selectedEntity;
    if (type === 'city') return mapData.cities.find(c => c.id === id);
    if (type === 'faction') return mapData.factions.find(f => f.id === id);
    if (type === 'continent') return mapData.continents.find(c => c.id === id);
    if (type === 'label') return mapData.labels.find(l => l.id === id);
    return null;
  })();

  const updateEntityName = (name: string) => {
    if (!selectedEntity || !mapData) return;
    setMapData(prev => {
      if (!prev) return null;
      const copy = { ...prev };
      const { type, id } = selectedEntity;
      if (type === 'city') {
        copy.cities = copy.cities.map(c => {
          if (c.id === id) {
            // If capital name changes, sync capital name field in faction
            if (c.is_capital) {
              copy.factions = copy.factions.map(f => f.id === c.faction_id ? { ...f, capital: name } : f);
            }
            return { ...c, name };
          }
          return c;
        });
      } else if (type === 'faction') {
        copy.factions = copy.factions.map(f => f.id === id ? { ...f, name } : f);
      } else if (type === 'continent') {
        copy.continents = copy.continents.map(c => c.id === id ? { ...c, name } : c);
      } else if (type === 'label') {
        copy.labels = copy.labels.map(l => l.id === id ? { ...l, text: name } : l);
      }
      return copy;
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1rem', height: 'calc(100vh - 180px)' }}>
      {/* Visual Canvas Board */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
        
        {/* Editor Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={addCity} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
              <PlusCircle size={13} style={{ marginRight: '0.2rem', color: '#60a5fa' }} /> 新增城市
            </button>
            <button className="btn-secondary" onClick={addFaction} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
              <Plus size={13} style={{ marginRight: '0.2rem', color: '#10b981' }} /> 新增宗门/势力
            </button>
            <button className="btn-secondary" onClick={addLabel} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
              <Sparkles size={13} style={{ marginRight: '0.2rem', color: '#eab308' }} /> 新增标签描述
            </button>
            {selectedEntity && (
              <button className="btn-secondary" onClick={deleteSelected} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: '#ef4444' }}>
                <Trash2 size={13} style={{ marginRight: '0.2rem' }} /> 删除所选
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={() => regenerateCoastline()} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} title="随机生成地形海岸线">
              <RotateCcw size={13} style={{ marginRight: '0.2rem' }} /> 重构海岸
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0 0.5rem', borderLeft: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>海岸大小</span>
              <input
                type="range"
                min="0.3"
                max="2.0"
                step="0.05"
                value={mapData.coastline_scale ?? 1.0}
                onChange={(e) => {
                  const scale = parseFloat(e.target.value);
                  const updated = { ...mapData, coastline_scale: scale };
                  setMapData(updated);
                  regenerateCoastline(updated);
                }}
                style={{ width: '80px' }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', minWidth: '28px' }}>{((mapData.coastline_scale ?? 1.0) * 100).toFixed(0)}%</span>
            </div>
            <button className="btn-secondary" onClick={() => {
              const cs = mapData.coastline_scale ?? 1.0;
              const newZoom = 1 / cs;
              const cx = mapData.width / 2;
              const cy = mapData.height / 2;
              setZoom(newZoom);
              setPan({ x: cx * (1 - newZoom), y: cy * (1 - newZoom) });
            }} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
              <Compass size={13} style={{ marginRight: '0.2rem' }} /> 重置视野
            </button>
            <button className="btn-primary" onClick={handleSaveMap} style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}>
              <Save size={13} style={{ marginRight: '0.2rem' }} /> 保存地图
            </button>
          </div>
        </div>

        {/* Dynamic Canvas Container */}
        <div 
          onWheel={handleWheel}
          style={{ 
            flex: 1, 
            position: 'relative', 
            background: '#070a12', 
            border: '1px solid var(--border-color)', 
            borderRadius: '6px', 
            overflow: 'hidden', 
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.95)',
            userSelect: 'none'
          }}
        >
          <svg 
            ref={svgRef}
            viewBox={`0 0 ${mapData.width} ${mapData.height}`} 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ width: '100%', height: '100%', cursor: isPanning ? 'grabbing' : 'grab' }}
          >
            <defs>
              {/* Grid Background */}
              <pattern id="canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.015)" strokeWidth="1" />
              </pattern>

              {/* Sea Ambient Glow */}
              <radialGradient id="seaGlow" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#0d1525" />
                <stop offset="100%" stopColor="#060911" />
              </radialGradient>

              {/* Gooey Warp Filter (Core Black Technology) */}
              <filter id="gooey-border">
                <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
              </filter>
            </defs>

            {/* Ocean Layer */}
            <rect width="100%" height="100%" fill="url(#seaGlow)" />
            <rect width="100%" height="100%" fill="url(#canvas-grid)" />

            {/* Inner Pan & Zoom Group */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              
              {/* Landmass Coastline (Fractal mid-point) */}
              {coastlinePath && (
                <>
                  <path 
                    d={coastlinePath} 
                    fill="#0c1322" 
                    stroke="rgba(96,165,250,0.06)" 
                    strokeWidth="16" 
                    strokeDasharray="4 6" 
                  />
                  <path 
                    d={coastlinePath} 
                    fill="#080e1b" 
                    stroke="rgba(255,255,255,0.02)" 
                    strokeWidth="2" 
                  />
                </>
              )}

              {/* Gooey Warping Faction Influence Borders */}
              {mapData.factions.map(faction => {
                // Find all cities belonging to this faction
                const factionCities = mapData.cities.filter(c => c.faction_id === faction.id);
                if (factionCities.length === 0) return null;

                return (
                  <g key={`goo-${faction.id}`} filter="url(#gooey-border)" style={{ opacity: 0.15 }}>
                    {factionCities.map(city => (
                      <circle 
                        key={`blob-${city.id}`} 
                        cx={city.x} 
                        cy={city.y} 
                        r={city.vision_radius ?? faction.influence_radius * (city.is_capital ? 1.0 : 0.7)} 
                        fill={faction.color} 
                      />
                    ))}
                  </g>
                );
              })}

              {/* Stroke Border Layer for Gooey borders (Slight outline tracing) */}
              {mapData.factions.map(faction => {
                const factionCities = mapData.cities.filter(c => c.faction_id === faction.id);
                if (factionCities.length === 0) return null;
                return (
                  <g key={`border-line-${faction.id}`} filter="url(#gooey-border)">
                    {factionCities.map(city => (
                      <circle 
                        key={`outline-${city.id}`} 
                        cx={city.x} 
                        cy={city.y} 
                        r={city.vision_radius ?? faction.influence_radius * (city.is_capital ? 1.0 : 0.7)} 
                        fill="none" 
                        stroke={faction.color} 
                        strokeWidth="1.5"
                        style={{ opacity: 0.2 }}
                      />
                    ))}
                  </g>
                );
              })}

              {/* Continent Labels */}
              {mapData.continents.map(continent => {
                const isSelected = selectedEntity?.type === 'continent' && selectedEntity.id === continent.id;
                return (
                  <text
                    key={continent.id}
                    x={continent.x}
                    y={continent.y}
                    textAnchor="middle"
                    fill={isSelected ? '#fff' : 'rgba(200, 200, 220, 0.55)'}
                    fontSize={isSelected ? '18' : '15'}
                    fontWeight="bold"
                    fontFamily="Georgia, serif"
                    letterSpacing="4"
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseDown={(e) => handleEntityMouseDown('continent', continent.id, e)}
                  >
                    {continent.name}
                  </text>
                );
              })}

              {/* Ocean / Description Labels */}
              {mapData.labels.map(label => {
                const isSelected = selectedEntity?.type === 'label' && selectedEntity.id === label.id;
                return (
                  <text
                    key={label.id}
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    fill={isSelected ? '#fff' : label.color}
                    fontSize={label.font_size}
                    fontStyle={label.style}
                    fontWeight="bold"
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseDown={(e) => handleEntityMouseDown('label', label.id, e)}
                  >
                    {label.text}
                  </text>
                );
              })}

              {/* Cities Nodes & Allegiance Flag Tags */}
              {mapData.cities.map(city => {
                const faction = mapData.factions.find(f => f.id === city.faction_id);
                const color = faction ? faction.color : '#9ca3af';
                const isSelected = selectedEntity?.type === 'city' && selectedEntity.id === city.id;

                return (
                  <g 
                    key={city.id} 
                    transform={`translate(${city.x}, ${city.y})`}
                    style={{ cursor: 'grab' }}
                    onMouseDown={(e) => handleEntityMouseDown('city', city.id, e)}
                  >
                    {/* Ripple Ambient for capitals */}
                    {city.is_capital && (
                      <circle 
                        r={(city.size || 8) + 6} 
                        fill="none" 
                        stroke={color} 
                        strokeWidth="1" 
                        style={{ opacity: isSelected ? 0.4 : 0.15 }} 
                      />
                    )}

                    {/* Standard marker */}
                    {city.is_capital ? (
                      // Capital Flag scaled by city.size
                      <polygon 
                        points={`0,-${city.size || 8} ${city.size || 8},0 0,${city.size || 8} -${city.size || 8},0`} 
                        fill={isSelected ? '#fff' : color} 
                        stroke={color} 
                        strokeWidth="1.5" 
                      />
                    ) : (
                      // Standard Town Node scaled by city.size
                      <circle 
                        r={city.size || 5.5} 
                        fill={isSelected ? '#fff' : 'rgba(255,255,255,0.75)'} 
                        stroke={color} 
                        strokeWidth="2" 
                      />
                    )}

                    {/* Label Tag */}
                    <text
                      y={city.is_capital ? -(city.size || 8) - 4 : (city.size || 5.5) + 10}
                      textAnchor="middle"
                      fill={isSelected ? '#fff' : '#d1d5db'}
                      fontSize="9.5"
                      fontWeight="bold"
                      style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.85))', pointerEvents: 'none' }}
                    >
                      {city.is_capital ? `▲ ${city.name}` : `· ${city.name}`}
                    </text>
                  </g>
                );
              })}

              {/* Decorative Compass Rose — OUTSIDE pan/zoom group, fixed in viewBox corner */}
            </g>

            <g transform={`translate(${mapData.width - 55}, 55)`} style={{ opacity: 0.18 }}>
              <circle r="30" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="2 3" />
              <line x1="0" y1="-40" x2="0" y2="40" stroke="#fff" strokeWidth="1.5" />
              <line x1="-40" y1="0" x2="40" y2="0" stroke="#fff" strokeWidth="1.5" />
              <polygon points="0,-40 6,-10 0,0 -6,-10" fill="#fff" />
              <polygon points="0,40 6,10 0,0 -6,10" fill="#fff" />
              <polygon points="-40,0 -10,-6 0,0 -10,6" fill="#fff" />
              <polygon points="40,0 10,-6 0,0 10,6" fill="#fff" />
              <text x="0" y="-45" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">N</text>
            </g>

          </svg>
        </div>
      </div>

      {/* Editor Details Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        
        {/* Entity Card Inspector */}
        <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff', margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            {activeEntity ? '疆域要素属性' : '点击地图要素查看属性'}
          </h3>
          
          {activeEntity && selectedEntity ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 'bold' }}>要素名称</label>
                <input 
                  type="text" 
                  value={(activeEntity as any).name || (activeEntity as any).text || ''}
                  onChange={(e) => updateEntityName(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem 0.5rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 'bold' }}>要素类型</label>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>
                  {selectedEntity.type === 'city' 
                    ? ((activeEntity as any).is_capital ? '主城据点' : '城市哨所') 
                    : selectedEntity.type === 'faction' 
                    ? '宗门/国家势力' 
                    : selectedEntity.type === 'label'
                    ? '描述标签'
                    : '奇幻大陆'}
                </span>
              </div>

              {selectedEntity.type === 'city' && (
                <>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 'bold' }}>所属势力归属</label>
                    <select
                      value={(activeEntity as City).faction_id}
                      onChange={(e) => {
                        const nextFactionId = e.target.value;
                        setMapData(prev => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            cities: prev.cities.map(c => c.id === activeEntity.id ? { ...c, faction_id: nextFactionId } : c)
                          };
                        });
                      }}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
                    >
                      <option value="">中立 / 无归属</option>
                      {mapData.factions.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 'bold' }}>城池规模大小 (Size)</label>
                    <input 
                      type="range"
                      min="3"
                      max="15"
                      value={(activeEntity as City).size || 6}
                      onChange={(e) => {
                        const sizeValue = parseInt(e.target.value);
                        setMapData(prev => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            cities: prev.cities.map(c => c.id === activeEntity.id ? { ...c, size: sizeValue } : c)
                          };
                        });
                      }}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      <span>3px (小型哨所)</span>
                      <span>{(activeEntity as City).size || 6}px</span>
                      <span>15px (超级宏伟巨城)</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 'bold' }}>视力范围 / 势力光晕</label>
                    <input 
                      type="range"
                      min="20"
                      max="300"
                      value={(activeEntity as City).vision_radius ?? ((() => {
                        const faction = mapData.factions.find(f => f.id === (activeEntity as City).faction_id);
                        return faction ? Math.round(faction.influence_radius * ((activeEntity as City).is_capital ? 1.0 : 0.7)) : 80;
                      })())}
                      onChange={(e) => {
                        const vr = parseInt(e.target.value);
                        setMapData(prev => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            cities: prev.cities.map(c => c.id === activeEntity.id ? { ...c, vision_radius: vr } : c)
                          };
                        });
                      }}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      <span>20px (针尖)</span>
                      <span>
                        {(activeEntity as City).vision_radius != null
                          ? `${(activeEntity as City).vision_radius}px (自定义)`
                          : '继承势力默认'}
                      </span>
                      <span>300px (巨域)</span>
                    </div>
                    {(activeEntity as City).vision_radius != null && (
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setMapData(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              cities: prev.cities.map(c => c.id === activeEntity.id ? { ...c, vision_radius: undefined } : c)
                            };
                          });
                        }}
                        style={{ marginTop: '0.3rem', padding: '2px 8px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}
                      >
                        ↩ 重置为势力默认
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>坐标 X</label>
                      <span style={{ color: '#fff' }}>{(activeEntity as City).x}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>坐标 Y</label>
                      <span style={{ color: '#fff' }}>{(activeEntity as City).y}</span>
                    </div>
                  </div>
                </>
              )}

              {selectedEntity.type === 'faction' && (
                <>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 'bold' }}>领土渲染颜色</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="color" 
                        value={(activeEntity as Faction).color.startsWith('hsl') ? '#10b981' : (activeEntity as Faction).color}
                        onChange={(e) => {
                          const hexColor = e.target.value;
                          setMapData(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              factions: prev.factions.map(f => f.id === activeEntity.id ? { ...f, color: hexColor } : f)
                            };
                          });
                        }}
                        style={{ width: '36px', height: '24px', border: 'none', background: 'none', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{(activeEntity as Faction).color}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 'bold' }}>势力简介 / 备注</label>
                    <textarea
                      value={(activeEntity as Faction).description ?? ''}
                      onChange={(e) => {
                        const desc = e.target.value;
                        setMapData(prev => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            factions: prev.factions.map(f => f.id === activeEntity.id ? { ...f, description: desc } : f)
                          };
                        });
                      }}
                      placeholder="在此记录势力背景、阵营关系、历史沿革等信息…"
                      style={{
                        width: '100%',
                        minHeight: '90px',
                        padding: '0.4rem 0.5rem',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '0.75rem',
                        lineHeight: '1.5',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </>
              )}

              {selectedEntity.type === 'label' && (
                <>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 'bold' }}>文字样式</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className={`btn-secondary ${ (activeEntity as MapLabel).style === 'normal' ? 'active' : ''}`}
                        onClick={() => {
                          setMapData(prev => prev ? {
                            ...prev,
                            labels: prev.labels.map(l => l.id === activeEntity.id ? { ...l, style: 'normal' } : l)
                          } : null);
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', flex: 1 }}
                      >
                        常规
                      </button>
                      <button 
                        className={`btn-secondary ${ (activeEntity as MapLabel).style === 'italic' ? 'active' : ''}`}
                        onClick={() => {
                          setMapData(prev => prev ? {
                            ...prev,
                            labels: prev.labels.map(l => l.id === activeEntity.id ? { ...l, style: 'italic' } : l)
                          } : null);
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', flex: 1 }}
                      >
                        斜体
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 'bold' }}>文字大小</label>
                    <select
                      value={(activeEntity as MapLabel).font_size}
                      onChange={(e) => {
                        const size = parseInt(e.target.value);
                        setMapData(prev => prev ? {
                          ...prev,
                          labels: prev.labels.map(l => l.id === activeEntity.id ? { ...l, font_size: size } : l)
                        } : null);
                      }}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
                    >
                      <option value="10">10px (小)</option>
                      <option value="12">12px (中)</option>
                      <option value="14">14px (大)</option>
                      <option value="18">18px (极高)</option>
                    </select>
                  </div>
                </>
              )}

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', lineHeight: '1.4', display: 'block' }}>
                  提示：在左侧画布上，你可以用鼠标左键拖拽此地标/要素来实时更改其地理坐标位置。
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'center' }}>
              <span>在左侧画布上，点击任意城市、宗门、大陆或文字描述</span>
              <span style={{ marginTop: '0.25rem' }}>即可在此展示和编辑其矢量疆域属性！</span>
            </div>
          )}
        </div>

        {/* Geopolitics Panel */}
        {mapData && mapData.factions.length > 0 && (
          <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff', margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              势力地缘分析
            </h3>
            {mapData.factions.map(faction => {
              const cityCount = mapData.cities.filter(c => c.faction_id === faction.id).length;
              const capitalCount = mapData.cities.filter(c => c.faction_id === faction.id && c.is_capital).length;
              const isEditing = editingFactionId === faction.id;
              return (
                <div key={faction.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: faction.color, flexShrink: 0 }} />
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingFactionName}
                      onChange={e => setEditingFactionName(e.target.value)}
                      onBlur={() => {
                        const trimmed = editingFactionName.trim();
                        if (trimmed) {
                          setMapData(prev => prev ? { ...prev, factions: prev.factions.map(f => f.id === faction.id ? { ...f, name: trimmed } : f) } : null);
                        }
                        setEditingFactionId(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingFactionId(null);
                      }}
                      style={{ flex: 1, padding: '0.15rem 0.35rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--accent-color)', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
                    />
                  ) : (
                    <span
                      title="点击修改势力名称"
                      onClick={() => { setEditingFactionId(faction.id); setEditingFactionName(faction.name); }}
                      style={{ flex: 1, color: '#fff', fontSize: '0.8rem', cursor: 'text', borderBottom: '1px dashed rgba(255,255,255,0.2)', paddingBottom: '1px' }}
                    >
                      {faction.name}
                    </span>
                  )}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {capitalCount > 0 ? `${capitalCount}主城` : ''}{cityCount - capitalCount > 0 ? ` ${cityCount - capitalCount}哨所` : ''}{cityCount === 0 ? '无城市' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
