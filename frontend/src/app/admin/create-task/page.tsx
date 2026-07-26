'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import MapPicker from '@/components/map/MapPicker';
import { tasksApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const CATEGORIES = ['food', 'health', 'shelter', 'education', 'water', 'sanitation', 'mental_health', 'disaster_relief', 'other'] as const;
const URGENCIES = ['low', 'medium', 'high', 'critical'] as const;

export default function CreateTaskPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('other');
  const [urgency, setUrgency] = useState<(typeof URGENCIES)[number]>('medium');
  const [address, setAddress] = useState('');
  const [requiredSkillsRaw, setRequiredSkillsRaw] = useState('');
  const [requiredVolunteers, setRequiredVolunteers] = useState(1);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const required_skills = useMemo(
    () => requiredSkillsRaw.split(',').map(s => s.trim()).filter(Boolean),
    [requiredSkillsRaw]
  );

  useEffect(() => {
    if (address.trim().length < 5) return;
    const id = window.setTimeout(async () => {
      setIsGeocoding(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address.trim())}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        const first = Array.isArray(data) ? data[0] : null;
        if (!first?.lat || !first?.lon) return;
        const lat = Number(first.lat);
        const lng = Number(first.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setLocation({ lat, lng });
      } finally {
        setIsGeocoding(false);
      }
    }, 700);
    return () => window.clearTimeout(id);
  }, [address]);

  const mut = useMutation({
    mutationFn: () => {
      if (!location) throw new Error('Please provide an address or pick a location on the map');
      if (title.trim().length < 5) throw new Error('Title must be at least 5 characters');
      if (description.trim().length < 3) throw new Error('Description must be at least 3 characters');
      return tasksApi.create({
        title: title.trim(),
        description: description.trim(),
        category,
        urgency,
        address: address || undefined,
        required_skills,
        required_volunteers: requiredVolunteers,
        latitude: location.lat,
        longitude: location.lng,
      });
    },
    onSuccess: () => {
      toast.success('Task created');
      setTitle('');
      setDescription('');
      setAddress('');
      setRequiredSkillsRaw('');
      setRequiredVolunteers(1);
      setLocation(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create task'),
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create resource need</h1>
          <p className="text-sm text-gray-500 dark:text-white/65">Create a task and auto-assign nearby volunteers.</p>
        </div>

        <div className="card p-5 space-y-4">
          <div className="grid gap-3">
            <label className="text-xs font-semibold text-gray-700 dark:text-white/80">Title</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Emergency food distribution" />
          </div>

          <div className="grid gap-3">
            <label className="text-xs font-semibold text-gray-700 dark:text-white/80">Description</label>
            <textarea className="input min-h-[120px]" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the need, constraints, and timeline…" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-white/80">Category</label>
              <select className="input" value={category} onChange={e => setCategory(e.target.value as any)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-white/80">Urgency</label>
              <select className="input" value={urgency} onChange={e => setUrgency(e.target.value as any)}>
                {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-white/80">Required skills (comma-separated)</label>
              <input className="input" value={requiredSkillsRaw} onChange={e => setRequiredSkillsRaw(e.target.value)} placeholder="medical, driving, logistics" />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-white/80">Volunteers needed</label>
              <input
                className="input"
                type="number"
                min={1}
                max={50}
                value={requiredVolunteers}
                onChange={e => setRequiredVolunteers(parseInt(e.target.value || '1'))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-white/80">Address / description (optional)</label>
            <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street / landmark / area" />
            {isGeocoding ? (
              <p className="text-[11px] text-gray-500 dark:text-white/60">Detecting location from address...</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-white/80">Location</label>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
  {location ? (
    <>
      <p className="font-medium text-gray-900">
        Selected Location
      </p>

      <p className="text-sm text-gray-600 mt-2">
        Latitude: {location.lat.toFixed(6)}
      </p>

      <p className="text-sm text-gray-600">
        Longitude: {location.lng.toFixed(6)}
      </p>
    </>
  ) : (
    <p className="text-sm text-gray-500">
      Location will be detected automatically from the address.
    </p>
  )}
</div>
            <p className="text-xs text-gray-500 dark:text-white/65">
              Location auto-fills from the address. You can still click the map to adjust it{location ? ` (${location.lat.toFixed(5)}, ${location.lng.toFixed(5)})` : ''}.
            </p>
          </div>

          <button className="btn-primary w-full" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create task
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

