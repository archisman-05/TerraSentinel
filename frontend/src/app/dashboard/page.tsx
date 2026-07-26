'use client';
import DisasterAnalysis from "../../components/dashboard/DisasterAnalysis";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, tasksApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import {
  ClipboardList, Users, FileText, CheckCircle2,
  AlertTriangle, TrendingUp, Sparkles, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';
import { useSocket } from '@/hooks/useSocket';
import { useEffect } from 'react';

const URGENCY_COLORS: Record<string, string> = { critical:'#7c3aed', high:'#ef4444', medium:'#f59e0b', low:'#22c55e' };
const CATEGORY_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

// ── NEW: Type matching the actual /api/dashboard/weekly-summary response ──
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

export default function DashboardPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { on } = useSocket();

  const { data: statsData, isLoading: statsLoading, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn:  () => dashboardApi.getStats().then(r => r.data.data),
    refetchInterval: 30_000,
    enabled: user?.role === 'admin',
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['weekly-summary'],
    queryFn:  () => dashboardApi.getWeeklySummary().then(r => r.data.data) as Promise<WeeklySummary>,
    staleTime: 5 * 60_000,
    enabled:  user?.role === 'admin',
  });

  const { data: recentTasksData } = useQuery({
    queryKey: ['recent-tasks'],
    queryFn:  () => tasksApi.list({ limit: 5, page: 1 }).then(r => r.data.data.tasks),
    refetchInterval: 15_000,
  });

  const { data: volunteerStatsData, isLoading: volunteerStatsLoading } = useQuery({
    queryKey: ['volunteer-dashboard-stats'],
    queryFn: () => dashboardApi.getVolunteerStats().then((r) => r.data.data),
    refetchInterval: 10_000,
    enabled: user?.role === 'volunteer',
  });

  const stats     = statsData;
  // FIXED: previously `summaryData?.summary` collapsed the whole object down
  // to just the executive-summary string, discarding majorEvents,
  // performanceAnalysis, resourceUsage, criticalFindings, recommendations,
  // nextWeekForecast, and confidence. Now `summary` keeps the full object.
  const summary   = summaryData;
  const recentTasks = recentTasksData || [];
  const volunteerStats = volunteerStatsData;
  const isVolunteer = user?.role === 'volunteer';

  useEffect(() => {
    const cleanups = [
      on('task:new', () => {
        qc.invalidateQueries({ queryKey: ['recent-tasks'] });
        qc.invalidateQueries({ queryKey: ['volunteer-dashboard-stats'] });
      }),
      on('task:updated', () => {
        qc.invalidateQueries({ queryKey: ['recent-tasks'] });
        qc.invalidateQueries({ queryKey: ['volunteer-dashboard-stats'] });
      }),
      on('assignment:new', () => qc.invalidateQueries({ queryKey: ['volunteer-dashboard-stats'] })),
      on('sos:alert', () => qc.invalidateQueries({ queryKey: ['volunteer-dashboard-stats'] })),
    ];
    return () => cleanups.forEach((c) => c());
  }, [on, qc]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-white/65">Real-time NGO resource overview</p>
          </div>
          <button onClick={() => refetch()} className="btn-secondary text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Stat cards */}
        {(isVolunteer ? volunteerStatsLoading : statsLoading) ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="stat-card animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-20" />
                <div className="h-8 bg-gray-100 rounded w-12" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isVolunteer ? (
              <>
                <StatCard icon={ClipboardList} label="Pending Tasks" value={volunteerStats?.pending_tasks} color="blue" sub="Awaiting action" />
                <StatCard icon={CheckCircle2} label="Completed Tasks" value={volunteerStats?.completed_tasks} color="green" sub="Successfully closed" />
                <StatCard icon={Users} label="Total Assignments" value={volunteerStats?.total_assignments} color="purple" sub="All-time assignments" />
                <StatCard icon={FileText} label="Unread Alerts" value={volunteerStats?.unread_notifications} color="amber" sub="Check notifications" />
              </>
            ) : (
              <>
                <StatCard icon={ClipboardList}  label="Total Tasks"       value={stats?.tasks?.total}        color="blue"   sub={`${stats?.tasks?.pending} pending`} />
                <StatCard icon={CheckCircle2}   label="Completed"         value={stats?.tasks?.completed}    color="green"  sub={`${stats?.tasks?.completed_this_week} this week`} />
                <StatCard icon={Users}          label="Volunteers"        value={stats?.volunteers?.total}   color="purple" sub={`${stats?.volunteers?.available} available`} />
                <StatCard icon={FileText}       label="Reports"           value={stats?.reports?.total}      color="amber"  sub={`${stats?.reports?.pending_review} pending review`} />
              </>
            )}
          </div>
        )}

        {/* AI Disaster Analysis */}
        {!isVolunteer && (
          <DisasterAnalysis />
        )}

        {!isVolunteer && <div className="grid lg:grid-cols-3 gap-6">
          {/* Urgency breakdown */}
          {/* <div className="card p-5">
            <h3 className="font-semibold text-sm mb-4">Active Tasks by Urgency</h3>
            {stats?.by_urgency?.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={stats.by_urgency} dataKey="count" nameKey="urgency" cx="50%" cy="50%" outerRadius={70} label={({ urgency, count }) => `${urgency} (${count})`} labelLine={false} fontSize={11}>
                    {stats.by_urgency.map((entry: { urgency: string }, i: number) => (
                      <Cell key={i} fill={URGENCY_COLORS[entry.urgency] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div> */}

          {/* By category */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold text-sm mb-4">Tasks by Category</h3>
            {stats?.by_category?.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.by_category} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {stats.by_category.map((_: unknown, i: number) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* AI Weekly Summary — FIXED SECTION */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-sm">AI Weekly Summary</h3>
            </div>
            {summaryLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : summary ? (
              <div className="space-y-3">
                {summary.summary && (
                  <p className="text-sm text-gray-700 dark:text-white/80">{summary.summary}</p>
                )}

                {typeof summary.confidence === 'number' && (
                  <span className="inline-block text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                    Confidence: {Math.round(summary.confidence * 100)}%
                  </span>
                )}

                {(summary.majorEvents?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">Major Events</p>
                    <ul className="space-y-1">
                      {summary.majorEvents.map((h: string, i: number) => (
                        <li key={`major-${i}`} className="flex items-start gap-1.5 text-xs text-gray-600">
                          <span className="text-brand-500 font-bold mt-0.5">✓</span>{h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.performanceAnalysis && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-white/60 mb-1">Performance Analysis</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{summary.performanceAnalysis}</p>
                  </div>
                )}

                {summary.resourceUsage && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-white/60 mb-1">Resource Usage</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{summary.resourceUsage}</p>
                  </div>
                )}

                {(summary.criticalFindings?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">Critical Findings</p>
                    <ul className="space-y-1">
                      {summary.criticalFindings.map((c: string, i: number) => (
                        <li key={`critical-${i}`} className="flex items-start gap-1.5 text-xs text-red-600">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(summary.recommendations?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-white/60 mb-1.5">Recommendations</p>
                    <ul className="space-y-1">
                      {summary.recommendations.map((r: string, i: number) => (
                        <li key={`rec-${i}`} className="flex items-start gap-1.5 text-xs text-gray-600">
                          <span className="text-green-500 font-bold mt-0.5">✓</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.nextWeekForecast && (
                  <p className="text-xs text-brand-700 bg-brand-50 px-3 py-2 rounded-lg italic">
                    "{summary.nextWeekForecast}"
                  </p>
                )}
              </div>
            ) : <p className="text-sm text-gray-500 dark:text-white/60">No summary available yet.</p>}
          </div>

          {/* Recent tasks */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Recent Tasks</h3>
              <Link href="/dashboard/tasks" className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            <div className="space-y-2">
              {recentTasks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-white/60">No tasks yet.</p>
              ) : recentTasks.map((task: Record<string, unknown>) => (
                <div key={task.id as string} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-300 ease-in-out">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: URGENCY_COLORS[task.urgency as string] || '#6b7280' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{task.title as string}</p>
                    <p className="text-xs text-gray-500 dark:text-white/60">{task.category as string} · {task.city as string || 'Unknown area'}</p>
                  </div>
                  <span className={`badge-${task.status}`}>{(task.status as string)?.replace('_',' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {!isVolunteer && stats?.tasks?.pending > 10 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">High pending task backlog</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {stats.tasks.pending} tasks are pending assignment. Consider running auto-assign for urgent tasks.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, color, sub }: { icon: React.ElementType; label: string; value?: number | string; color: string; sub?: string }) {
  const colors: Record<string, string> = { blue:'bg-blue-50 text-blue-600', green:'bg-green-50 text-green-600', purple:'bg-purple-50 text-purple-600', amber:'bg-amber-50 text-amber-600' };
  return (
    <div className="stat-card transition-all duration-300 ease-in-out hover:shadow-2xl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-white/60 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value ?? '–'}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-white/60">{sub}</p>}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[180px] flex items-center justify-center">
      <div className="text-center">
        <TrendingUp className="w-8 h-8 text-gray-200 mx-auto mb-2" />
        <p className="text-xs text-gray-500 dark:text-white/60">No data yet</p>
      </div>
    </div>
  );
}