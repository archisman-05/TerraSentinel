'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { tasksApi, dashboardApi } from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import {
  Sparkles,
  MapPin,
  Loader2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Gauge,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Weekly Summary type (from previous fix, unchanged) ────────────────────
interface WeeklySummary {
  summary: string;
  majorEvents: string[];
  performanceAnalysis: string;
  resourceUsage: string;
  criticalFindings: string[];
  recommendations: string[];
  nextWeekForecast: string;
  confidence: number;
}

// ── NEW: Type matching the actual /api/tasks/insights response ────────────
interface AreaInsight {
  riskScore: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  summary: string;
  recommendations: string[];
}

// ── NEW: Priority → badge color mapping ────────────────────────────────────
function getPriorityStyles(priority?: string) {
  switch ((priority || '').toLowerCase()) {
    case 'low':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'medium':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'high':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'critical':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

// ── NEW: Risk score → color mapping (0-100 scale assumed) ──────────────────
function getRiskColor(score?: number) {
  if (score == null) return { bar: 'bg-gray-300', text: 'text-gray-500', badge: 'bg-gray-50 text-gray-600 border-gray-200' };
  if (score <= 25) return { bar: 'bg-green-500', text: 'text-green-700', badge: 'bg-green-50 text-green-700 border-green-200' };
  if (score <= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
  if (score <= 75) return { bar: 'bg-orange-500', text: 'text-orange-700', badge: 'bg-orange-50 text-orange-700 border-orange-200' };
  return { bar: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-50 text-red-700 border-red-200' };
}

export default function InsightsPage() {
  const [areaName,  setAreaName]  = useState('');
  const [lat,       setLat]       = useState('');
  const [lng,       setLng]       = useState('');
  const [radius,    setRadius]    = useState('10');
  // CHANGED: insight is now typed as AreaInsight | null instead of Record<string, unknown>
  const [insight,   setInsight]   = useState<AreaInsight | null>(null);
  const [summary,   setSummary]   = useState<WeeklySummary | null>(null);

  // CHANGED: mutationFn/onSuccess now correctly destructure { insight } from r.data.data,
  // and the resulting insight is typed as AreaInsight.
  const areaInsightMut = useMutation({
    mutationFn: () =>
      tasksApi
        .getInsights({ lat, lng, radius_km: radius, area_name: areaName || 'Selected Area' })
        .then((r) => r.data.data as { insight: AreaInsight }),
    onSuccess: (data) => setInsight(data.insight),
    onError:   () => toast.error('Failed to generate insights'),
  });

  const summaryMut = useMutation({
    mutationFn: () => dashboardApi.getWeeklySummary().then(r => r.data.data) as Promise<WeeklySummary>,
    onSuccess: (data) => setSummary(data),
    onError:   () => toast.error('Failed to generate weekly summary'),
  });

  const detectLocation = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
      toast.success('Location set');
    });
  };

  const riskColors = getRiskColor(insight?.riskScore);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Insights</h1>
            <p className="text-sm text-gray-500 dark:text-white/65">Gemini-powered analysis and recommendations</p>
          </div>
        </div>

        {/* Area Analysis */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Area Analysis</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Area Name</label>
              <input className="input" placeholder="e.g. North Kolkata" value={areaName} onChange={e => setAreaName(e.target.value)} />
            </div>
            <div>
              <label className="label">Latitude</label>
              <input className="input" placeholder="22.5726" value={lat} onChange={e => setLat(e.target.value)} />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input className="input" placeholder="88.3639" value={lng} onChange={e => setLng(e.target.value)} />
            </div>
            <div>
              <label className="label">Radius (km)</label>
              <input className="input" type="number" value={radius} onChange={e => setRadius(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button className="btn-secondary w-full text-sm" onClick={detectLocation}>
                <MapPin className="w-4 h-4" /> Use My Location
              </button>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => areaInsightMut.mutate()}
            disabled={areaInsightMut.isPending || !lat || !lng}
          >
            {areaInsightMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {areaInsightMut.isPending ? 'Analysing with Gemini…' : 'Generate Area Insights'}
          </button>

          {/* ── FIXED: Area Risk Assessment ─────────────────────────────── */}
          {insight ? (
            <div className="space-y-4 animate-fade-in border-t border-gray-100 pt-4">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Area Risk Assessment</p>
              </div>

              {/* Risk Score + Priority */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Risk Score card */}
                <div className="rounded-xl border border-gray-100 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-gray-500" />
                      <p className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase">Risk Score</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${riskColors.badge}`}>
                      {typeof insight.riskScore === 'number' ? `${insight.riskScore}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${riskColors.bar}`}
                      style={{
                        width: `${typeof insight.riskScore === 'number' ? Math.min(Math.max(insight.riskScore, 0), 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Priority card */}
                <div className="rounded-xl border border-gray-100 p-4 flex flex-col justify-between">
                  <p className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase mb-2">Priority</p>
                  <span
                    className={`inline-flex w-fit items-center text-sm font-bold px-3 py-1 rounded-full border ${getPriorityStyles(
                      insight.priority
                    )}`}
                  >
                    {insight.priority || 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Summary card */}
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-purple-900 mb-1">Summary</p>
                <p className="text-sm text-purple-800 leading-relaxed">
                  {insight.summary?.trim() ? insight.summary : 'No summary available for this area.'}
                </p>
              </div>

              {/* Recommendations */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Recommendations</p>
                </div>
                {(insight.recommendations?.length ?? 0) > 0 ? (
                  <ul className="space-y-1.5">
                    {insight.recommendations.map((r, i) => (
                      <li key={`insight-rec-${i}`} className="text-sm text-gray-600 flex items-start gap-1.5">
                        <span className="text-green-400 font-bold mt-0.5">✓</span>{r}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">No recommendations available.</p>
                )}
              </div>
            </div>
          ) : (
            areaInsightMut.isSuccess && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-400">No insight data returned for this area.</p>
              </div>
            )
          )}
        </div>

        {/* Weekly Summary — unchanged from previous fix */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Weekly AI Summary</h2>
            <button className="btn-secondary text-xs" onClick={() => summaryMut.mutate()} disabled={summaryMut.isPending}>
              {summaryMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Generate
            </button>
          </div>

          {summary ? (
            <div className="space-y-4 animate-fade-in">
              {summary.summary && (
                <p className="text-sm text-gray-700 dark:text-white/80 leading-relaxed">{summary.summary}</p>
              )}

              {typeof summary.confidence === 'number' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase">Confidence</span>
                  <span className="badge bg-brand-50 text-brand-700">
                    {Math.round(summary.confidence * 100)}%
                  </span>
                </div>
              )}

              {(summary.majorEvents?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase mb-1.5">Major Events</p>
                  <ul className="space-y-1">
                    {summary.majorEvents.map((e, i) => (
                      <li key={`event-${i}`} className="text-sm text-gray-600 dark:text-white/75 flex items-start gap-1.5">
                        <span className="text-brand-500">✓</span>{e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.performanceAnalysis && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase">Performance Analysis</p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-white/75 leading-relaxed">{summary.performanceAnalysis}</p>
                </div>
              )}

              {summary.resourceUsage && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase mb-1.5">Resource Usage</p>
                  <p className="text-sm text-gray-600 dark:text-white/75 leading-relaxed">{summary.resourceUsage}</p>
                </div>
              )}

              {(summary.criticalFindings?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <p className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase">Critical Findings</p>
                  </div>
                  {summary.criticalFindings.map((c, i) => (
                    <div key={`finding-${i}`} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{c}</p>
                    </div>
                  ))}
                </div>
              )}

              {(summary.recommendations?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase">Recommendations</p>
                  </div>
                  <ul className="space-y-1">
                    {summary.recommendations.map((r, i) => (
                      <li key={`rec-${i}`} className="text-sm text-gray-600 dark:text-white/75 flex items-start gap-1.5">
                        <span className="text-green-400 font-bold mt-0.5">✓</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.nextWeekForecast && (
                <p className="text-sm text-brand-700 bg-brand-50 rounded-xl px-4 py-3 italic">
                  "{summary.nextWeekForecast}"
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-white/60">Click Generate to produce a Gemini-powered weekly summary.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}