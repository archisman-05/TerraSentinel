'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { assignmentsApi, tasksApi, volunteersApi } from '@/lib/api';
import { ArrowLeft, Briefcase, Loader2, Mail, MapPin, Star } from 'lucide-react';

type VolunteerDetails = {
  id: string;
  full_name: string;
  email?: string;
  skills?: string[];
  availability?: string;
  total_tasks_done?: number;
  years_experience?: number;
  grace_points?: number;
  city?: string;
  lat?: number;
  lng?: number;
  distance_km?: number;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

export default function VolunteerDetailsPage() {
  const params = useParams<{ id: string }>();
  const volunteerId = String(params.id);
  const router = useRouter();
  const [taskId, setTaskId] = useState('');
  const [viewerLocation, setViewerLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setViewerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => null,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  const volunteerQ = useQuery({
    queryKey: ['volunteer-details', volunteerId],
    queryFn: () => volunteersApi.getById(volunteerId).then((r) => r.data.data),
    enabled: !!volunteerId,
  });

  const tasksQ = useQuery({
    queryKey: ['assignable-tasks', volunteerId],
    queryFn: () => tasksApi.list({ status: 'pending', limit: 50 }).then((r) => r.data.data.tasks || []),
  });

  const assignMut = useMutation({
    mutationFn: () => assignmentsApi.create({ task_id: taskId, volunteer_id: volunteerId }),
    onSuccess: () => {
      toast.success('Volunteer assigned successfully.');
      setTaskId('');
      volunteerQ.refetch();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create assignment.'),
  });

  const volunteer = volunteerQ.data?.volunteer as VolunteerDetails | undefined;
  const history = useMemo(() => volunteerQ.data?.recent_assignments || [], [volunteerQ.data]);
  const computedDistance = useMemo(() => {
    if (typeof volunteer?.distance_km === 'number' && Number.isFinite(volunteer.distance_km)) {
      return `${volunteer.distance_km.toFixed(1)} km`;
    }
    if (
      viewerLocation &&
      typeof volunteer?.lat === 'number' &&
      typeof volunteer?.lng === 'number'
    ) {
      return `${haversineKm(viewerLocation, { lat: volunteer.lat, lng: volunteer.lng }).toFixed(1)} km`;
    }
    return 'N/A';
  }, [viewerLocation, volunteer?.distance_km, volunteer?.lat, volunteer?.lng]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <button
          type="button"
          onClick={() => router.push('/dashboard/volunteers')}
          className="btn-secondary text-xs transition-all duration-300 ease-in-out active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to volunteers
        </button>

        {volunteerQ.isLoading ? (
          <div className="card-glass p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : volunteerQ.isError || !volunteer ? (
          <div className="card-glass p-6 text-sm text-red-600 dark:text-red-300">
            Failed to load volunteer details.
          </div>
        ) : (
          <>
            <div className="card-glass p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{volunteer.full_name}</h1>
                  <p className="text-sm text-gray-600 dark:text-white/65">{volunteer.email || 'No email provided'}</p>
                </div>
                <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                  {volunteer.availability || 'unknown'}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                <Metric label="Experience" value={`${volunteer.years_experience ?? 0} years`} />
                <Metric label="Grace points" value={String(volunteer.grace_points ?? 0)} />
                <Metric label="Assigned tasks" value={String(volunteer.total_tasks_done ?? 0)} />
                <Metric label="Distance" value={computedDistance} />
                <Metric label="Location" value={volunteer.city || 'Unknown'} icon={<MapPin className="w-3 h-3" />} />
                <Metric label="Rating" value={String((volunteer as any).rating ?? 'N/A')} icon={<Star className="w-3 h-3" />} />
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {(volunteer.skills || []).length > 0 ? (
                    (volunteer.skills || []).map((skill) => (
                      <span key={skill} className="badge bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">{skill}</span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-600 dark:text-white/65">No skills listed.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="card-glass p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Actions</p>
              <div className="grid md:grid-cols-[1fr_auto] gap-2">
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="input"
                >
                  <option value="">Select a pending task to assign</option>
                  {(tasksQ.data || []).map((task: any) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => assignMut.mutate()}
                  disabled={!taskId || assignMut.isPending}
                  className="btn-primary transition-all duration-300 ease-in-out active:scale-95"
                >
                  {assignMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                  Hire / Assign
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' })}
                  className="btn-secondary text-xs transition-all duration-300 ease-in-out active:scale-95"
                >
                  View history
                </button>
                {volunteer.email && (
                  <a href={`mailto:${volunteer.email}`} className="btn-secondary text-xs transition-all duration-300 ease-in-out active:scale-95">
                    <Mail className="w-3.5 h-3.5" />
                    Contact
                  </a>
                )}
              </div>
            </div>

            <div id="history" className="card-glass p-5">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Assignment history</p>
              {history.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-white/65">No assignment history yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((item: any) => (
                    <div key={item.id} className="rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.task_title}</p>
                      <p className="text-xs text-gray-600 dark:text-white/65">
                        {item.category} - {item.task_status}
                      </p>
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

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
      <p className="text-xs text-gray-600 dark:text-white/65">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1 inline-flex items-center gap-1">
        {icon}
        {value}
      </p>
    </div>
  );
}
