'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { notificationsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Bell, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '@/hooks/useSocket';
import { useEffect } from 'react';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { on } = useSocket();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data.data.notifications || []),
    refetchInterval: 10000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const respondMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'reject' }) =>
      notificationsApi.respond(id, action),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'accept' ? 'Join request accepted' : 'Join request rejected');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => toast.error('Failed to respond'),
  });

  const notifications = (data || []) as any[];

  useEffect(() => {
    const cleanups = [
      on('notification:new', () => qc.invalidateQueries({ queryKey: ['notifications'] })),
      on('assignment:new', () => qc.invalidateQueries({ queryKey: ['notifications'] })),
      on('assignment:updated', () => qc.invalidateQueries({ queryKey: ['notifications'] })),
      on('task:updated', () => qc.invalidateQueries({ queryKey: ['notifications'] })),
    ];
    return () => cleanups.forEach((c) => c());
  }, [on, qc]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-gray-500 dark:text-white/65">Task assignments, join requests, and SOS updates.</p>
        </div>

        {isLoading ? (
          <div className="card p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="card p-10 text-center text-gray-500 dark:text-white/60">No notifications yet.</div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{n.title}</p>
                      {!n.is_read && <span className="badge bg-red-100 text-red-700">new</span>}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-white/75 mt-1">{n.message}</p>
                    <p className="text-xs text-gray-500 dark:text-white/60 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>

                    {n.type === 'task_join_request' && user?.role === 'admin' && !n?.data?.response_action && !n.is_read && (
                      <div className="mt-3 flex gap-2">
                        <button
                          className="btn-primary text-xs"
                          onClick={() => respondMut.mutate({ id: n.id, action: 'accept' })}
                          disabled={respondMut.isPending}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Accept
                        </button>
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => respondMut.mutate({ id: n.id, action: 'reject' })}
                          disabled={respondMut.isPending}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                  {!n.is_read && (
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => markReadMut.mutate(n.id)}
                      disabled={markReadMut.isPending}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
