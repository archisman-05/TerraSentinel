'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { CheckCircle2, PlayCircle, MapPin, Clock, Loader2, Sparkles, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { Modal } from '@/components/ui/Modal';

interface Assignment {
  id: string;
  task_id: string;
  task_title: string;
  category: string;
  urgency: string;
  task_address?: string;
  is_ai_matched: boolean;
  ai_match_reason?: string;
  match_score: number;
  accepted_at: string | null;
  completed_at: string | null;
  status?: string;
  reason?: string | null;
  created_at: string;
}

export default function AssignmentsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { on } = useSocket();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-assignments', user?.id],
    queryFn:  () => assignmentsApi.list({ volunteer_id: user?.id }).then(r => r.data.data.assignments as Assignment[]),
    refetchInterval: 15_000,
    enabled: !!user,
  });

  const acceptMut = useMutation({
    mutationFn: (id: string) => assignmentsApi.accept(id),
    onSuccess: () => { toast.success('Task accepted!'); qc.invalidateQueries({ queryKey: ['my-assignments'] }); },
    onError:   () => toast.error('Failed to accept'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => assignmentsApi.reject(id, reason),
    onSuccess: (res) => {
      const penalty = res.data?.data?.grace_penalty ?? 0;
      toast.success(penalty ? `Rejected (−${penalty} grace points)` : 'Rejected');
      qc.invalidateQueries({ queryKey: ['my-assignments'] });
    },
    onError:   () => toast.error('Failed to reject'),
  });

  const completeMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      assignmentsApi.complete(id, { volunteer_notes: notes }),
    onSuccess: () => { toast.success('Task marked complete! 🎉'); qc.invalidateQueries({ queryKey: ['my-assignments'] }); },
    onError:   () => toast.error('Failed to complete'),
  });

  const assignments: Assignment[] = data ?? [];
  const active    = assignments.filter(a => !a.completed_at);
  const completed = assignments.filter(a => !!a.completed_at);

  useEffect(() => {
    const cleanups = [
      on('assignment:new', () => qc.invalidateQueries({ queryKey: ['my-assignments'] })),
      on('assignment:updated', () => qc.invalidateQueries({ queryKey: ['my-assignments'] })),
      on('task:updated', () => qc.invalidateQueries({ queryKey: ['my-assignments'] })),
    ];
    return () => cleanups.forEach((c) => c());
  }, [on, qc]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Assignments</h1>
          <p className="text-sm text-gray-500 dark:text-white/65">{active.length} active · {completed.length} completed</p>
        </div>

        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-white/60 uppercase tracking-wide">Active Tasks</h2>
                {active.map(a => (
                  <AssignmentCard
                    key={a.id}
                    assignment={a}
                    onAccept={() => acceptMut.mutate(a.id)}
                    onReject={() => {
                      setRejectTarget(a.id);
                      setRejectReason('');
                    }}
                    onComplete={(notes) => completeMut.mutate({ id: a.id, notes })}
                    accepting={acceptMut.isPending}
                    rejecting={rejectMut.isPending}
                    completing={completeMut.isPending}
                  />
                ))}
              </div>
            )}

            {completed.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-white/60 uppercase tracking-wide">Completed</h2>
                {completed.map(a => (
                  <div key={a.id} className="card p-4 opacity-60">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm">{a.task_title}</p>
                        <p className="text-xs text-gray-500 dark:text-white/60">
                          Completed {formatDistanceToNow(new Date(a.completed_at!), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {assignments.length === 0 && (
              <div className="card p-12 text-center">
                <p className="text-gray-500 dark:text-white/60">No assignments yet. Keep your profile updated to get matched!</p>
              </div>
            )}
          </>
        )}
      </div>
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject Assignment"
        description="Please share a clear reason so admins can reassign quickly."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                if (!rejectTarget) return;
                if (rejectReason.trim().length < 5) {
                  toast.error('Please provide at least 5 characters.');
                  return;
                }
                rejectMut.mutate({ id: rejectTarget, reason: rejectReason.trim() });
                setRejectTarget(null);
              }}
            >
              Submit rejection
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          <label className="label">Reason</label>
          <textarea
            className="input min-h-[120px]"
            placeholder="Ex: I am currently handling a medical emergency in another zone."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}

function AssignmentCard({
  assignment, onAccept, onReject, onComplete, accepting, rejecting, completing,
}: {
  assignment: Assignment;
  onAccept: () => void;
  onReject: () => void;
  onComplete: (notes: string) => void;
  accepting: boolean;
  rejecting: boolean;
  completing: boolean;
}) {
  const isAccepted = !!assignment.accepted_at;
  const urgencyDot: Record<string, string> = {
    critical: 'bg-purple-500',
    high:     'bg-red-500',
    medium:   'bg-amber-500',
    low:      'bg-green-500',
  };

  return (
    <div className="card p-4 hover:shadow-xl transition-all duration-300 ease-in-out">
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${urgencyDot[assignment.urgency] ?? 'bg-gray-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`badge-${assignment.urgency}`}>{assignment.urgency}</span>
            <span className="badge bg-gray-100 text-gray-600">
              {assignment.category.replace('_', ' ')}
            </span>
            {assignment.is_ai_matched && (
              <span className="badge bg-purple-50 text-purple-600 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> AI Matched
              </span>
            )}
          </div>

          <p className="font-semibold text-gray-900 dark:text-white">{assignment.task_title}</p>

          {assignment.task_address && (
            <p className="text-xs text-gray-600 dark:text-white/65 mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {assignment.task_address}
            </p>
          )}

          {assignment.ai_match_reason && (
            <div className="mt-2 bg-purple-50 border border-purple-100 rounded-lg p-2">
              <p className="text-xs text-purple-700 flex items-start gap-1">
                <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{assignment.ai_match_reason}</span>
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-white/60 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Assigned {formatDistanceToNow(new Date(assignment.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
        {!isAccepted ? (
          <>
            <button
              className="btn-primary flex-1 text-sm"
              onClick={onAccept}
              disabled={accepting || rejecting}
            >
              {accepting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <PlayCircle className="w-3.5 h-3.5" />}
              Accept &amp; Start
            </button>
            <button
              className="flex-1 text-sm inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              onClick={onReject}
              disabled={accepting || rejecting}
            >
              {rejecting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <XCircle className="w-3.5 h-3.5" />}
              Reject
            </button>
          </>
        ) : (
          <button
            className="btn-primary flex-1 text-sm bg-green-600 hover:bg-green-700 focus:ring-green-500"
            onClick={() => {
              const notes = window.prompt('Add completion notes (optional):') ?? '';
              onComplete(notes);
            }}
            disabled={completing}
          >
            {completing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CheckCircle2 className="w-3.5 h-3.5" />}
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}
