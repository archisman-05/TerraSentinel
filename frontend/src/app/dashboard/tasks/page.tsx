'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, assignmentsApi } from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Sparkles, Loader2, User, MapPin, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUSES   = ['', 'pending', 'assigned', 'in_progress', 'completed'];
const URGENCIES  = ['', 'critical', 'high', 'medium', 'low'];
const CATEGORIES = ['', 'food', 'health', 'shelter', 'education', 'water', 'sanitation', 'mental_health', 'disaster_relief', 'other'];

interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  address?: string;
  city?: string;
  ai_summary?: string;
  ai_priority_score: number;
  assigned_volunteers?: { volunteer_id: string; volunteer_name: string }[];
  leader_id?: string | null;
  leader_name?: string | null;
}

interface VolunteerMatch {
  user_id: string;
  full_name: string;
  distance_km: number;
  rating: number;
  skills: string[];
  algo_score: number;
  final_score?: number;
  ai_reasoning?: string;
  recommended?: boolean;
}

interface MatchResult {
  volunteers: VolunteerMatch[];
  aiMatching?: {
    matching_insight?: string;
  };
}

export default function TasksPage() {
  const qc = useQueryClient();
  const [filters, setFilters]           = useState({ status: '', urgency: '', category: '' });
  const [page, setPage]                 = useState(1);
  const [matchModal, setMatchModal]     = useState<Task | null>(null);
  const [matchData,  setMatchData]      = useState<MatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', filters, page],
    queryFn: () =>
      tasksApi
        .list({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page, limit: 15 })
        .then(r => r.data.data),
    refetchInterval: 15_000,
  });

  const autoAssignMut = useMutation({
    mutationFn: (id: string) => tasksApi.autoAssign(id),
    onSuccess: () => { toast.success('Volunteer auto-assigned!'); qc.invalidateQueries({ queryKey: ['tasks'] }); },
    onError:   () => toast.error('Auto-assign failed'),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => tasksApi.updateStatus(id, status),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['tasks'] }); },
  });
  const setLeaderMut = useMutation({
    mutationFn: ({ taskId, volunteerId }: { taskId: string; volunteerId: string }) => tasksApi.setLeader(taskId, volunteerId),
    onSuccess: () => {
      toast.success('Leader selected');
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => toast.error('Failed to set leader'),
  });

  const loadMatches = async (task: Task) => {
    setMatchModal(task);
    setMatchLoading(true);
    setMatchData(null);
    try {
      const res = await tasksApi.getMatches(task.id, { useAI: 'true' });
      setMatchData(res.data.data as MatchResult);
    } catch {
      toast.error('Failed to load matches');
    } finally {
      setMatchLoading(false);
    }
  };

  const assignVolunteer = async (taskId: string, volunteerId: string, aiReason: string) => {
    try {
      await assignmentsApi.create({ task_id: taskId, volunteer_id: volunteerId, ai_match_reason: aiReason });
      toast.success('Volunteer assigned!');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setMatchModal(null);
    } catch {
      toast.error('Assignment failed');
    }
  };

  const tasks: Task[]     = data?.tasks ?? [];
  const pagination        = data?.pagination;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <p className="text-sm text-gray-500 dark:text-white/65">{pagination?.total ?? '…'} total</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {([['status', STATUSES], ['urgency', URGENCIES], ['category', CATEGORIES]] as [string, string[]][]).map(([key, opts]) => (
            <select
              key={key}
              className="input w-auto text-sm"
              value={filters[key as keyof typeof filters]}
              onChange={e => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(1); }}
            >
              {opts.map(o => (
                <option key={o} value={o}>{o ? o.replace('_', ' ') : `All ${key}s`}</option>
              ))}
            </select>
          ))}
        </div>

        {isLoading ? (
          <div className="card p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto" />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Title', 'Category', 'Urgency', 'Status', 'Location', 'Assignments', 'Priority', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tasks.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-medium truncate">{task.title}</p>
                        <p className="text-xs text-gray-400 truncate">{task.ai_summary ?? task.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge bg-gray-100 text-gray-600">{task.category.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge-${task.urgency}`}>{task.urgency}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none"
                          value={task.status}
                          onChange={e => updateStatusMut.mutate({ id: task.id, status: e.target.value })}
                        >
                          {['pending', 'assigned', 'in_progress', 'completed', 'cancelled'].map(s => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {task.city ?? task.address ?? '–'}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[220px]">
                        {(task.assigned_volunteers?.length || 0) > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600 dark:text-white/70">
                              {task.assigned_volunteers?.map((v) => v.volunteer_name).join(', ')}
                            </p>
                            <select
                              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none bg-transparent"
                              value={task.leader_id || ''}
                              onChange={(e) => {
                                if (!e.target.value) return;
                                setLeaderMut.mutate({ taskId: task.id, volunteerId: e.target.value });
                              }}
                            >
                              <option value="">Choose leader</option>
                              {task.assigned_volunteers?.map((v) => (
                                <option key={v.volunteer_id} value={v.volunteer_id}>
                                  {v.volunteer_name}
                                </option>
                              ))}
                            </select>
                            {task.leader_name && (
                              <p className="text-[11px] text-brand-600 dark:text-brand-300">Leader: {task.leader_name}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">No volunteers assigned yet</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{ width: `${task.ai_priority_score ?? 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{Math.round(task.ai_priority_score ?? 0)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            title="AI Match"
                            className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                            onClick={() => loadMatches(task)}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Auto-assign"
                            className="p-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                            onClick={() => autoAssignMut.mutate(task.id)}
                            disabled={autoAssignMut.isPending}
                          >
                            <User className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex justify-center gap-1 p-4 border-t border-gray-100">
                {Array.from({ length: pagination.pages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium ${
                      page === i + 1
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Match Modal */}
      {matchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-ink-950 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h2 className="font-bold text-gray-900 dark:text-white">AI Volunteer Matching</h2>
              </div>
              <button onClick={() => setMatchModal(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-white/60">Task</p>
                <p className="font-semibold text-gray-900 dark:text-white">{matchModal.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`badge-${matchModal.urgency}`}>{matchModal.urgency}</span>
                  <span className="badge bg-gray-100 text-gray-600">{matchModal.category}</span>
                </div>
              </div>

              {matchLoading ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto" />
                  <p className="text-sm text-gray-500 dark:text-white/65 mt-2">AI is analysing volunteers…</p>
                </div>
              ) : matchData ? (
                <>
                  {matchData.aiMatching?.matching_insight && (
                    <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-400/20 rounded-xl p-3">
                      <p className="text-xs font-medium text-purple-700 dark:text-purple-200 mb-1">AI Insight</p>
                      <p className="text-xs text-purple-800 dark:text-purple-100">{matchData.aiMatching.matching_insight}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase tracking-wide">Top Matches</p>
                    {matchData.volunteers.map((vol, i) => (
                      <div
                        key={vol.user_id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                          i === 0 ? 'border-purple-200 bg-purple-50 dark:bg-purple-500/10 dark:border-purple-400/20' : 'border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center flex-shrink-0">
                          {vol.full_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">{vol.full_name}</p>
                            {i === 0 && (
                              <span className="badge bg-purple-100 text-purple-700">Best Match</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-white/60 mt-0.5">
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />
                              {vol.distance_km?.toFixed(1)}km
                            </span>
                            <span>★ {vol.rating}</span>
                          </div>
                          {vol.ai_reasoning && (
                            <p className="text-xs text-gray-500 dark:text-white/65 mt-1 line-clamp-2">{vol.ai_reasoning}</p>
                          )}
                          <div className="mt-1.5 flex items-center gap-1">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full"
                                style={{ width: `${vol.final_score ?? vol.algo_score ?? 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-purple-600">
                              {Math.round(vol.final_score ?? vol.algo_score ?? 0)}%
                            </span>
                          </div>
                        </div>
                        <button
                          className="btn-primary text-xs py-1.5 flex-shrink-0"
                          onClick={() => assignVolunteer(matchModal.id, vol.user_id, vol.ai_reasoning ?? '')}
                        >
                          Assign <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-white/60">No matches found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
