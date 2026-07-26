'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { reportsApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function CentralReportsPage() {
  const [cityFilter, setCityFilter] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['central-reports-insights', cityFilter],
    queryFn: () => reportsApi.centralInsights({ city: cityFilter || undefined }).then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  const summary = data?.summary;
  const ai = data?.ai_insights;
  const recentReports = summary?.recent_reports || [];
  const cityOptions = useMemo(
    () => ((summary?.top_cities || []).map((c: { city: string }) => c.city).filter((c: string) => c && c !== 'Unknown')),
    [summary?.top_cities]
  );

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Central Report System</h1>
          <p className="text-sm text-gray-500 dark:text-white/65">
            NGO-wide reporting with AI forecasting for future needs.
          </p>
        </div>
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="label">Filter recommendations by location</label>
              <input
                className="input"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Type city/area (e.g. Kolkata)"
                list="central-city-options"
              />
              <datalist id="central-city-options">
                {cityOptions.map((city: string) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </div>
            <button className="btn-secondary" onClick={() => setCityFilter('')}>Clear</button>
          </div>
        </div>

        {isLoading ? (
          <div className="card p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : isError ? (
          <div className="card p-6 text-red-600 dark:text-red-300">Failed to load central insights.</div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <Metric label="Total Reports" value={String(summary?.total_reports || 0)} />
              <Metric label="Pending Reports" value={String(summary?.pending_reports || 0)} />
              <Metric label="Last 30 Days" value={String(summary?.reports_last_30d || 0)} />
            </div>

            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Top Report Cities</h2>
              <div className="space-y-2">
                {(summary?.top_cities || []).map((item: any) => (
                  <div key={item.city} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-white/80">{item.city}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">AI Forecast & Recommendations</h2>
              <p className="text-sm text-gray-700 dark:text-white/75">{ai?.headline || 'No AI insight available right now.'}</p>
              <ul className="mt-3 space-y-3">
  {(ai?.recommendations || []).map(
    (
      rec: {
        title: string;
        description: string;
        urgency: string;
      },
      index: number
    ) => (
      <li
        key={`${rec.title}-${index}`}
        className="rounded-lg border p-3"
      >
        <div className="font-semibold">
          {rec.title}
        </div>

        <div className="text-sm text-gray-600 mt-1">
          {rec.description}
        </div>

        <span className="mt-2 inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          {rec.urgency}
        </span>
      </li>
    )
  )}
</ul>
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 dark:border-white/10 p-3">
                  <p className="text-xs text-gray-500 dark:text-white/60 mb-1">Future Demand (Next 30 Days)</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {ai?.future_needs_forecast?.next_30_days_estimated_reports ?? '—'} reports
                  </p>
                  {Array.isArray(ai?.future_needs_forecast?.risk_areas) && ai.future_needs_forecast.risk_areas.length > 0 && (
                    <p className="text-xs text-gray-600 dark:text-white/70 mt-1">
                      Risk areas: {ai.future_needs_forecast.risk_areas.join(', ')}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-white/10 p-3">
                  <p className="text-xs text-gray-500 dark:text-white/60 mb-1">Volunteer Need Forecast</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {ai?.volunteer_forecast?.volunteers_needed_total ?? ai?.resource_needs?.volunteers_needed ?? '—'} volunteers
                  </p>
                  <p className="text-xs text-gray-600 dark:text-white/70 mt-1">
                    Surge buffer: {ai?.volunteer_forecast?.surge_buffer ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Reports with Location</h2>
              {recentReports.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-white/65">No reports found for this location filter.</p>
              ) : (
                <div className="space-y-3">
                  {recentReports.map((report: any) => (
                    <div key={report.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{report.title}</p>
                        <span className={`badge-${report.urgency}`}>{report.urgency}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-white/70 mt-1">
                        {(report.address || report.city || 'Location unavailable')} · {new Date(report.created_at).toLocaleDateString()}
                      </p>
                      {report.lat && report.lng && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-white/15 h-40">
                          <iframe
                            title={`map-${report.id}`}
                            className="w-full h-full"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(String(report.lat))},${encodeURIComponent(String(report.lng))}&z=14&output=embed`}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 dark:text-white/60">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}
