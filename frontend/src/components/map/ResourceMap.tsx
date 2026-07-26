'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { ngosApi, tasksApi, volunteersApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { useSosStore } from '@/features/sos/store/sosStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import {
  Search,
  X,
  Locate,
  RotateCcw,
  Layers,
  Maximize,
  ShieldAlert,
  Users,
  ListChecks,
  Building2,
  CloudSun,
  Gauge,
  Plus,
  Minus,
  Sparkles,
  HeartPulse,
  Sailboat,
  Package,
  Thermometer,
  Droplets,
  CloudRain,
  Wind,
  Mountain,
  Route,
  Ambulance,
  Download,
  Rocket,
  MapPin,
} from 'lucide-react';

type LatLng = { lat: number; lng: number };

interface MapProps {
  showVolunteers?: boolean;
  showHeatmap?: boolean;
  onTaskClick?: (task: Record<string, unknown>) => void;
  height?: string;
}

interface AnalysisResult {
  riskScore?: number;
  riskLevel?: string;
  confidence?: number;
  disasterType?: string;
  summary?: string;
  reasoning?: string[];
  immediateActions?: string[];
  recommendedVolunteers?: number;
  recommendedMedicalTeams?: number;
  recommendedFoodKits?: number;
  recommendedBoats?: number;
  recommendedAmbulances?: number;
  expectedResponseTime?: string;
}

interface EnvironmentData {
  temperature?: number;
  rain?: number;
  humidity?: number;
  wind?: number;
  elevation?: number;
  roadCount?: number;
}

function haversineKm(a: LatLng, b: LatLng) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function circleIcon(color: string, size = 20) {
  return L.divIcon({
    className: '',
    html: `
      <div class="marker-dot" style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${color};
        border:3px solid #ffffff;
        box-shadow:0 4px 10px rgba(0,0,0,0.35), 0 0 0 2px ${color}33;
        transition:transform 0.2s ease, box-shadow 0.2s ease;
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function sosIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:30px;height:30px;">
        <div class="sos-pulse-ring"></div>
        <div style="
          position:absolute;top:50%;left:50%;width:16px;height:16px;
          border-radius:50%;background:#ef4444;border:3px solid #fff;
          transform:translate(-50%,-50%);
          box-shadow:0 4px 12px rgba(239,68,68,0.6);
        "></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const myLocationIcon = circleIcon('#10b981', 18);

function RecenterOnce({
  position,
  zoom,
  trigger,
}: {
  position: LatLng | null;
  zoom: number;
  trigger: any;
}) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.setView([position.lat, position.lng], zoom, { animate: true });
  }, [map, position?.lat, position?.lng, trigger]); // eslint-disable-line
  return null;
}

function ClickCatcher({ onMapClick }: { onMapClick: (loc: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Zoom / layer stack — dashboard card style
function GlassZoomControls({ onToggleDark }: { onToggleDark: () => void }) {
  const map = useMap();
  return (
    <div className="absolute bottom-6 left-5 z-[999] flex flex-col gap-2">
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-1.5 flex flex-col gap-1">
        <button
          onClick={() => map.zoomIn()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
        >
          <Plus size={17} />
        </button>
        <button
          onClick={() => map.zoomOut()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
        >
          <Minus size={17} />
        </button>
        <div className="h-px bg-gray-100 mx-1" />
        <button
          onClick={onToggleDark}
          title="Layers"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
        >
          <Layers size={17} />
        </button>
      </div>
    </div>
  );
}

// Search input — plain dashboard-style input, no glass blur
function SearchBox({ onSelect }: { onSelect: (loc: LatLng, label: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q || q.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q
        )}&limit=6&countrycodes=in`
      );
      const data = await res.json();
      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  return (
    <div className="w-full">
      <div className="relative flex items-center rounded-xl bg-white border border-gray-100 shadow-sm px-3.5 py-2.5 transition-all focus-within:border-emerald-300">
        <Search size={15} className="text-gray-400 mr-2.5 shrink-0" />
        <input
          type="text"
          value={query}
          placeholder="Search city, village, river..."
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          className="flex-1 bg-transparent outline-none text-[13px] font-medium text-gray-800 placeholder:text-gray-400"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
            className="ml-2 shrink-0 rounded-full p-1 hover:bg-gray-100 transition-colors"
          >
            <X size={13} className="text-gray-400" />
          </button>
        )}
      </div>

      {open && (results.length > 0 || loading) && (
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl bg-white border border-gray-100 shadow-lg py-1.5 animate-[fadeIn_0.15s_ease-out]">
          {loading && (
            <li className="px-4 py-2.5 text-[12px] text-gray-400">Searching…</li>
          )}
          {results.map((r: any) => (
            <li
              key={r.place_id}
              className="px-4 py-2.5 text-[12px] cursor-pointer text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => {
                const lat = parseFloat(r.lat);
                const lng = parseFloat(r.lon);
                setQuery(r.display_name);
                setOpen(false);
                onSelect({ lat, lng }, r.display_name);
              }}
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Row-style stat, icon badge left, bold value right
function StatRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}14`, color }}
        >
          {icon}
        </div>
        <span className="text-[12.5px] font-medium text-gray-500">{label}</span>
      </div>
      <span className="text-[13px] font-bold text-gray-900">{value}</span>
    </div>
  );
}

// Metric card — used for Environment grid inside the AI panel
function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 border border-gray-100 py-3 px-2">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: `${color}14`, color }}
      >
        {icon}
      </div>
      <span className="text-[13px] font-bold text-gray-900">{value}</span>
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
    </div>
  );
}

// Resource card — used for Recommended Resources grid inside the AI panel
function ResourceCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 border border-gray-100 py-3.5 px-1 hover:shadow-sm transition-shadow">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: `${color}1a`, color }}
      >
        {icon}
      </div>
      <span className="text-[14px] font-bold text-gray-900">{value}</span>
      <span className="text-[9.5px] font-semibold text-gray-500 uppercase tracking-wide text-center leading-tight">{label}</span>
    </div>
  );
}

export default function ResourceMap({
  showVolunteers = true,
  showHeatmap = true,
  onTaskClick,
  height = '100%',
}: MapProps) {
  const { on } = useSocket();
  const user = useAuthStore((s) => s.user);
  const sosAlert = useSosStore((s) => s.activeAlert);

  const [tasks, setTasks] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [ngos, setNgos] = useState<any[]>([]);
  const [selected, setSelected] = useState<
    | { type: 'task'; item: any }
    | { type: 'volunteer'; item: any }
    | { type: 'ngo'; item: any }
    | null
  >(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [didAutoFocus, setDidAutoFocus] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AnalysisResult | null>(null);
  const [envData, setEnvData] = useState<EnvironmentData | null>(null);
  // UI-only: controls the mobile bottom-drawer visibility for the AI panel
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const mapCenter = useMemo<LatLng>(() => ({ lat: 20.5937, lng: 78.9629 }), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const loadMapData = useCallback(async () => {
    try {
      const [tasksRes, volRes, ngoRes] = await Promise.allSettled([
        tasksApi.getMap(),
        showVolunteers
          ? volunteersApi.getMap()
          : Promise.resolve({ data: { data: { volunteers: [] } } }),
        ngosApi.getMap(),
      ]);

      if (tasksRes.status === 'fulfilled') {
        setTasks((tasksRes.value as any).data.data.tasks || []);
      }
      if (volRes.status === 'fulfilled') {
        setVolunteers((volRes.value as any).data.data.volunteers || []);
      }
      if (ngoRes.status === 'fulfilled') {
        setNgos((ngoRes.value as any).data.data.ngos || []);
      }
    } catch {
      console.error('Error loading map data');
    }
  }, [showVolunteers]);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => null,
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8_000 }
    );
  }, []);

  useEffect(() => {
    if (!userPos || didAutoFocus) return;
    setDidAutoFocus(true);
    setRecenterTrigger((t) => t + 1);
  }, [userPos, didAutoFocus]);

  useEffect(() => {
    const cleanup = on('task:new', loadMapData);
    return cleanup;
  }, [on, loadMapData]);

  useEffect(() => {
    const cleanup = on('volunteer:moved', (data: any) => {
      setVolunteers((prev) =>
        prev.map((v: any) => (v.id === data.userId ? { ...v, lat: data.lat, lng: data.lng } : v))
      );
    });
    return cleanup;
  }, [on]);

  const handleSearchSelect = (loc: LatLng, label?: string) => {
    setSelectedLocation(loc);
    setSelectedLabel(label ?? null);
    setAiResult(null);
    setEnvData(null);
    setRecenterTrigger((t) => t + 1);
  };

  const handleMapClick = (loc: LatLng) => {
    setSelected(null);
    setSelectedLocation(loc);
    setSelectedLabel(null);
    setAiResult(null);
    setEnvData(null);
    setRecenterTrigger((t) => t + 1);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(loc);
        setSelectedLocation(loc);
        setSelectedLabel('Your current location');
        setAiResult(null);
        setEnvData(null);
        setRecenterTrigger((t) => t + 1);
        toast.success('Location set');
      },
      () => toast.error('Unable to fetch your location'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8_000 }
    );
  };

  const handleResetView = () => {
    setSelectedLocation(null);
    setSelectedLabel(null);
    setAiResult(null);
    setEnvData(null);
    setRecenterTrigger((t) => t + 1);
  };

  const handleAnalyze = async () => {
    if (!selectedLocation) {
      toast.error('Select a location first.');
      return;
    }

    setAnalyzing(true);
    try {
      const res = await axios.post('http://localhost:8080/api/disaster/analyze', {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
      });
      const { data, ai } = res.data;
      setEnvData(data as EnvironmentData);
      setAiResult(ai as AnalysisResult);
      setMobileDrawerOpen(true);
    } catch (err) {
      console.error(err);
      toast.error('Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadReport = () => {
    if (!aiResult) return;
    const blob = new Blob([JSON.stringify({ location: selectedLocation, environment: envData, analysis: aiResult }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'disaster-analysis-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const focusTarget = selectedLocation || userPos;
  const availableVolunteers = volunteers.filter((v) => v.availability === 'available').length;

  const tileUrl = darkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';

  // Shared AI panel content — reused for desktop floating card and mobile bottom drawer
  const aiPanelContent = (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-emerald-500" />
        <h3 className="text-[14px] font-bold text-gray-900 tracking-tight">
          AI Analysis Result
        </h3>
      </div>

      {/* Selected Location — folded into AI panel instead of a dedicated section */}
      <div className="mb-4 pb-4 border-b border-gray-100">
        <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Selected Location</div>
        {selectedLocation ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <MapPin size={13} />
            </div>
            <div className="text-[12px] text-gray-700 leading-tight">
              <div className="font-semibold text-gray-900">{selectedLabel || 'Selected location'}</div>
              <div className="text-gray-400">
                {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[12px] text-gray-400">No location selected</div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="text-4xl font-bold text-gray-900">
          {aiResult?.riskScore ?? '—'}
        </div>
        <div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">Risk Score</div>
          {aiResult?.riskLevel && (
            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold uppercase">
              {aiResult.riskLevel}
            </span>
          )}
        </div>
      </div>

      {typeof aiResult?.confidence === 'number' && (
        <div className="text-[11px] text-gray-500 mb-3">
          Confidence: <span className="font-semibold text-emerald-600">{Math.round(aiResult.confidence * 100)}%</span>
        </div>
      )}

      {aiResult?.disasterType && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <div className="text-[10px] text-gray-400 uppercase font-semibold">Disaster Type</div>
          <div className="text-[13px] font-semibold text-gray-900">{aiResult.disasterType}</div>
        </div>
      )}

      {aiResult?.summary && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Summary</div>
          <p className="text-[12px] text-gray-600 leading-relaxed">
            {aiResult.summary}
          </p>
        </div>
      )}

      {Array.isArray(aiResult?.reasoning) && aiResult!.reasoning!.length > 0 && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Reasoning</div>
          <ul className="space-y-1">
            {aiResult!.reasoning!.map((r, i) => (
              <li key={`ai-reason-${i}`} className="text-[12px] text-gray-600 flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold mt-0.5">✓</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(aiResult?.immediateActions) && aiResult!.immediateActions!.length > 0 && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Immediate Actions</div>
          <ul className="space-y-1">
            {aiResult!.immediateActions!.map((a, i) => (
              <li key={`ai-action-${i}`} className="text-[12px] text-red-600 flex items-start gap-1.5">
                <span className="font-bold mt-0.5">!</span>{a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Environment — moved inside AI panel instead of a dedicated sidebar section */}
      <div className="mb-3 pb-3 border-b border-gray-100">
        <div className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Environment</div>
        {envData ? (
          <div className="grid grid-cols-3 gap-2">
            <MetricCard icon={<Thermometer size={14} />} label="Temp" value={envData.temperature != null ? `${envData.temperature}°` : '—'} color="#f97316" />
            <MetricCard icon={<Droplets size={14} />} label="Humidity" value={envData.humidity != null ? `${envData.humidity}%` : '—'} color="#0ea5e9" />
            <MetricCard icon={<CloudRain size={14} />} label="Rain" value={envData.rain ?? '—'} color="#3b82f6" />
            <MetricCard icon={<Wind size={14} />} label="Wind" value={envData.wind ?? '—'} color="#14b8a6" />
            <MetricCard icon={<Mountain size={14} />} label="Elevation" value={envData.elevation ?? '—'} color="#84cc16" />
            <MetricCard icon={<Route size={14} />} label="Roads" value={envData.roadCount ?? '—'} color="#64748b" />
          </div>
        ) : (
          <div className="text-[12px] text-gray-400">No environment data</div>
        )}
      </div>

      {/* Recommended Resources — moved inside AI panel instead of a dedicated sidebar section */}
      <div className="mb-3 pb-3 border-b border-gray-100">
        <div className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Recommended Resources</div>
        <div className="grid grid-cols-2 gap-2">
          <ResourceCard icon={<Users size={16} />} label="Volunteers" value={aiResult?.recommendedVolunteers ?? '—'} color="#3b82f6" />
          <ResourceCard icon={<HeartPulse size={16} />} label="Medical" value={aiResult?.recommendedMedicalTeams ?? '—'} color="#ef4444" />
          <ResourceCard icon={<Package size={16} />} label="Food Kits" value={aiResult?.recommendedFoodKits ?? '—'} color="#f59e0b" />
          <ResourceCard icon={<Sailboat size={16} />} label="Boats" value={aiResult?.recommendedBoats ?? '—'} color="#0ea5e9" />
          <ResourceCard icon={<Ambulance size={16} />} label="Ambulances" value={aiResult?.recommendedAmbulances ?? '—'} color="#dc2626" />
        </div>
      </div>

      {aiResult?.expectedResponseTime && (
        <div className="mb-4 text-[11px] text-gray-500">
          Estimated Response Time: <span className="font-semibold text-gray-700">{aiResult.expectedResponseTime}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={handleDownloadReport}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-900 text-white text-[12px] font-bold shadow-sm hover:bg-gray-800 active:scale-95 transition-all"
        >
          <Download size={14} />
          Download Report
        </button>
        <button
          onClick={() => toast.success('Deployment request sent')}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-600 text-white text-[12px] font-bold shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
        >
          <Rocket size={14} />
          Deploy Resources
        </button>
      </div>
    </>
  );

  return (
    <div style={{ width: '100%', height }} className="flex flex-col gap-4">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sosRing { 0% { transform: scale(0.4); opacity: 0.9; } 70% { opacity: 0.15; } 100% { transform: scale(2.4); opacity: 0; } }
        .marker-dot:hover { transform: scale(1.35); box-shadow: 0 6px 16px rgba(0,0,0,0.45); }
        .sos-pulse-ring {
          position: absolute; top: 50%; left: 50%; width: 30px; height: 30px;
          border-radius: 50%; background: rgba(239,68,68,0.5);
          transform: translate(-50%,-50%); animation: sosRing 1.6s ease-out infinite;
        }
        .leaflet-popup-content-wrapper { border-radius: 16px !important; padding: 0 !important; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.18) !important; }
        .leaflet-popup-content { margin: 0 !important; }
        .leaflet-popup-tip { box-shadow: 0 4px 10px rgba(0,0,0,0.12) !important; }
      `}</style>

      {/* Page header — matches Dashboard "Dashboard / Real-time NGO resource overview" pattern */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Live Map</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Real-time disaster intelligence and resource allocation</p>
      </div>

      {/* Large map card — fills remaining space, no left sidebar inside this component */}
      <div className="relative flex-1 rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white min-h-[520px]">
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={5}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          scrollWheelZoom
          className="z-0"
        >
          <TileLayer
            url={tileUrl}
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          />

          <RecenterOnce position={focusTarget} zoom={selectedLocation ? 14 : 13} trigger={recenterTrigger} />
          <ClickCatcher onMapClick={handleMapClick} />
          <GlassZoomControls onToggleDark={() => setDarkMode((d) => !d)} />

          {sosAlert && (
            <Marker
              position={[sosAlert.lat, sosAlert.lng]}
              icon={sosIcon()}
              eventHandlers={{
                click: () =>
                  setSelected({ type: 'task', item: { title: 'SOS Alert', ...sosAlert } } as any),
              }}
            >
              <Popup>
                <div className="min-w-[220px] p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wide">
                      SOS
                    </span>
                  </div>
                  <div className="font-bold text-sm text-gray-900">SOS Alert</div>
                </div>
              </Popup>
            </Marker>
          )}

          {userPos && (
            <Marker position={[userPos.lat, userPos.lng]} icon={myLocationIcon}>
              <Popup>
                <div className="p-3 text-sm font-semibold text-gray-800">Your location</div>
              </Popup>
            </Marker>
          )}

          {tasks.map((task: any) => {
            if (task.lat == null || task.lng == null) return null;
            return (
              <Marker
                key={task.id}
                position={[task.lat, task.lng]}
                icon={circleIcon('#ef4444')}
                eventHandlers={{
                  click: () => {
                    setSelected({ type: 'task', item: task });
                    onTaskClick?.(task);
                  },
                }}
              >
                <Popup>
                  <div className="min-w-[240px] p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wide">
                        Task
                      </span>
                    </div>
                    <div className="font-bold text-[14px] text-gray-900">{task.title}</div>
                    <div className="text-[12px] text-gray-500 mt-1">{task.address || task.category}</div>
                    {userPos && (
                      <div className="text-[12px] text-gray-700 font-medium mt-2">
                        📍 {haversineKm(userPos, { lat: task.lat, lng: task.lng }).toFixed(1)} km away
                      </div>
                    )}
                    {Array.isArray(task.required_skills) && task.required_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {task.required_skills.map((s: string) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {user?.role === 'volunteer' && task.id && (
                      <button
                        className="mt-3 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all text-white text-[12px] font-bold shadow-sm"
                        onClick={async () => {
                          const msg = window.prompt('Optional message to admin (why you can help):') || '';
                          try {
                            await tasksApi.requestJoin(String(task.id), msg);
                            toast.success('Join request sent to admin.');
                          } catch (e: any) {
                            toast.error(e?.response?.data?.message || 'Failed to send request');
                          }
                        }}
                      >
                        Request to join
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {showVolunteers &&
            volunteers.map((vol: any) => {
              if (vol.lat == null || vol.lng == null) return null;
              const color = vol.availability === 'available' ? '#3b82f6' : '#94a3b8';
              return (
                <Marker
                  key={vol.id}
                  position={[vol.lat, vol.lng]}
                  icon={circleIcon(color)}
                  eventHandlers={{ click: () => setSelected({ type: 'volunteer', item: vol }) }}
                >
                  <Popup>
                    <div className="min-w-[220px] p-4">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide mb-1.5"
                        style={{
                          background: vol.availability === 'available' ? '#dbeafe' : '#f1f5f9',
                          color: vol.availability === 'available' ? '#1d4ed8' : '#64748b',
                        }}
                      >
                        {vol.availability}
                      </span>
                      <div className="font-bold text-[14px] text-gray-900">{vol.full_name}</div>
                      {userPos && (
                        <div className="text-[12px] text-gray-700 font-medium mt-2">
                          📍 {haversineKm(userPos, { lat: vol.lat, lng: vol.lng }).toFixed(1)} km away
                        </div>
                      )}
                      {Array.isArray(vol.skills) && vol.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {vol.skills.map((s: string) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {ngos.map((ngo: any) => {
            if (ngo.lat == null || ngo.lng == null) return null;
            return (
              <Marker
                key={ngo.id}
                position={[ngo.lat, ngo.lng]}
                icon={circleIcon('#22c55e')}
                eventHandlers={{ click: () => setSelected({ type: 'ngo', item: ngo }) }}
              >
                <Popup>
                  <div className="min-w-[220px] p-4">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-bold uppercase tracking-wide mb-1.5">
                      NGO
                    </span>
                    <div className="font-bold text-[14px] text-gray-900">{ngo.name}</div>
                    <div className="text-[12px] text-gray-500 mt-1">{ngo.address || ngo.city || 'NGO'}</div>
                    {userPos && (
                      <div className="text-[12px] text-gray-700 font-medium mt-2">
                        📍 {haversineKm(userPos, { lat: ngo.lat, lng: ngo.lng }).toFixed(1)} km away
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {selectedLocation && (
            <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={circleIcon('#a855f7', 22)}>
              <Popup>
                <div className="p-3 text-sm font-semibold text-gray-800">
                  {selectedLabel || 'Selected location'}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Floating search bar — top center, desktop + mobile */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[998] w-[92%] max-w-[420px]">
          <SearchBox onSelect={handleSearchSelect} />
        </div>

        {/* Live Intelligence — floating dashboard-style card, top-left */}
        <div className="absolute top-5 left-5 z-[999] w-[240px] rounded-2xl bg-white shadow-sm border border-gray-100 p-4 hidden md:block">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-emerald-500" />
            <h3 className="text-[12px] font-bold text-gray-900 tracking-tight">
              Live Intelligence
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            <StatRow icon={<Building2 size={13} />} label="NGOs" value={ngos.length} color="#22c55e" />
            <StatRow
              icon={<Users size={13} />}
              label="Volunteers"
              value={`${availableVolunteers}/${volunteers.length}`}
              color="#3b82f6"
            />
            <StatRow icon={<ListChecks size={13} />} label="Active Tasks" value={tasks.length} color="#ef4444" />
            <StatRow icon={<ShieldAlert size={13} />} label="SOS Alerts" value={sosAlert ? 1 : 0} color="#dc2626" />
            <StatRow icon={<CloudSun size={13} />} label="Weather" value={envData?.temperature != null ? `${envData.temperature}°` : '—'} color="#f59e0b" />
            <StatRow
              icon={<Gauge size={13} />}
              label="AI Risk Score"
              value={aiResult?.riskScore != null ? String(aiResult.riskScore) : '—'}
              color="#a855f7"
            />
          </div>
        </div>

        {/* Top-right action buttons */}
        <div className="absolute top-5 right-5 z-[999] flex gap-2">
          <button
            onClick={handleLocateMe}
            title="Locate me"
            className="w-10 h-10 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Locate size={16} />
          </button>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            title="Fullscreen"
            className="w-10 h-10 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Maximize size={16} />
          </button>
        </div>

        {/* AI Analysis Result — desktop/tablet floating card, right side, 340px, scrollable */}
        {aiResult && (
          <div className="absolute top-20 right-5 bottom-6 z-[997] w-[340px] overflow-y-auto rounded-2xl bg-white shadow-md border border-gray-100 p-5 hidden md:block">
            {aiPanelContent}
          </div>
        )}

        {/* Legend — bottom-right, hidden on small screens to avoid clutter under the AI card */}
        <div className="absolute bottom-6 right-5 z-[996] rounded-2xl bg-white shadow-sm border border-gray-100 px-4 py-3 hidden lg:block">
          <div className="flex flex-col gap-1.5 text-[11px] font-medium text-gray-700">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> NGO</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Volunteer</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> SOS</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Disaster Zone</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Selected Area</div>
          </div>
        </div>

        {/* Bottom controls — Analyze + Reset, dashboard button styles */}
        {selectedLocation && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[999] flex gap-3">
            <button
              onClick={handleResetView}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 text-[13px] font-bold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
            >
              <RotateCcw size={15} />
              Reset
            </button>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-[13px] font-bold shadow-sm hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-70"
            >
              <ShieldAlert size={16} />
              {analyzing ? 'Analyzing…' : 'Analyze Selected Area'}
            </button>
          </div>
        )}

        {/* Mobile bottom drawer — AI panel replacement for small screens */}
        {aiResult && mobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-[1000] flex items-end">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative w-full max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white shadow-md border border-gray-100 p-5 pb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="w-10 h-1.5 rounded-full bg-gray-200 mx-auto" />
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50"
              >
                <X size={16} />
              </button>
              {aiPanelContent}
            </div>
          </div>
        )}

        {/* Mobile: reopen drawer button if AI result exists but drawer was dismissed */}
        {aiResult && !mobileDrawerOpen && (
          <div className="md:hidden absolute bottom-24 left-1/2 -translate-x-1/2 z-[999]">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-[12px] font-bold shadow-sm active:scale-95 transition-all"
            >
              <Sparkles size={14} />
              View AI Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}