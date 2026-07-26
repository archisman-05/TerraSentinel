'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { assignmentsApi, volunteersApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Edit3, Loader2, MapPin, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const ALL_SKILLS = ['medical','driving','cooking','construction','teaching','counseling','logistics','translation','IT support','fundraising','first aid','social work','photography','carpentry','plumbing'];
const LANGUAGES  = ['English','Hindi','Bengali','Tamil','Telugu','Marathi','Gujarati','Urdu','Punjabi','Malayalam'];

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const profile = user?.profile;
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    bio: '', skills: [] as string[], languages: [] as string[],
    availability: 'available', weekly_hours: 10,
    address: '', city: '', country: '', phone: '',
    radius_km: 10, latitude: '', longitude: '',
  });

  useEffect(() => {
    if (profile) {
      setForm(f => ({
        ...f,
        bio:          profile.bio || '',
        skills:       profile.skills || [],
        languages:    profile.languages || [],
        availability: profile.availability || 'available',
        weekly_hours: profile.weekly_hours || 10,
        address:      profile.address || '',
        city:         profile.city || '',
        country:      profile.country || '',
        phone:        user?.phone || '',
        radius_km:    profile.radius_km || 10,
        latitude:     profile.lat?.toString() || '',
        longitude:    profile.lng?.toString() || '',
      }));
    }
  }, [profile, user?.phone]);

  const updateMut = useMutation({
    mutationFn: () => volunteersApi.updateProfile(form),
    onSuccess: () => {
      toast.success('Profile updated!');
      fetchMe();
      setIsEditing(false);
    },
    onError:   () => toast.error('Update failed'),
  });
  const { data: history = [] } = useQuery({
    queryKey: ['profile-history'],
    queryFn: () => assignmentsApi.list({ volunteer_id: user?.id, limit: 10 }).then((r) => r.data.data.assignments || []),
    enabled: !!user?.id,
  });

  const toggleArr = (key: 'skills' | 'languages', val: string) =>
    setForm(f => ({ ...f, [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val] }));

  const detectLocation = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
      toast.success('Location set');
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
          <p className="text-sm text-gray-500 dark:text-white/65">Keep your profile updated to get better matches</p>
        </div>

        {/* User info (read-only) */}
        <div className="card p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xl">
            {user?.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{user?.full_name}</p>
            <p className="text-sm text-gray-500 dark:text-white/65">{user?.email}</p>
            <p className="text-xs text-gray-500 dark:text-white/60">{user?.phone || 'Phone not added'}</p>
            <span className="badge bg-brand-100 text-brand-700 mt-1">Volunteer</span>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500 dark:text-white/60">Grace Points</p>
            <p className="text-lg font-bold text-brand-700 dark:text-brand-200">{profile?.grace_points ?? 0}</p>
          </div>
        </div>

        {/* Edit form */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900 dark:text-white">Saved Details</p>
            <button type="button" className="btn-secondary text-xs" onClick={() => setIsEditing((v) => !v)}>
              <Edit3 className="w-3.5 h-3.5" />
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea disabled={!isEditing} className="input min-h-[80px] resize-none disabled:opacity-70" placeholder="Tell us about yourself and your experience…" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
          </div>

          <div>
            <label className="label">Skills</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ALL_SKILLS.map(s => (
                <button key={s} type="button" disabled={!isEditing} onClick={() => toggleArr('skills', s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${form.skills.includes(s) ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Languages</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {LANGUAGES.map(l => (
                <button key={l} type="button" disabled={!isEditing} onClick={() => toggleArr('languages', l)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${form.languages.includes(l) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Availability</label>
              <select disabled={!isEditing} className="input" value={form.availability} onChange={e => setForm(f => ({ ...f, availability: e.target.value }))}>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <div>
              <label className="label">Weekly Hours Available</label>
              <input disabled={!isEditing} type="number" className="input" min={1} max={80} value={form.weekly_hours} onChange={e => setForm(f => ({ ...f, weekly_hours: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input disabled={!isEditing} className="input" placeholder="+91..." value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">City</label>
              <input disabled={!isEditing} className="input" placeholder="Your city" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label className="label">Service Radius (km)</label>
              <input disabled={!isEditing} type="number" className="input" min={1} max={200} value={form.radius_km} onChange={e => setForm(f => ({ ...f, radius_km: parseInt(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="label">Location</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input disabled={!isEditing} className="input" placeholder="Latitude" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
              <input disabled={!isEditing} className="input" placeholder="Longitude" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
            </div>
            <button type="button" disabled={!isEditing} className="btn-secondary text-xs w-full" onClick={detectLocation}>
              <MapPin className="w-3.5 h-3.5" /> Auto-detect Location
            </button>
          </div>

          {isEditing && (
            <button className="btn-primary w-full" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {updateMut.isPending ? 'Saving…' : 'Save Profile'}
            </button>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Task History</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-white/65">No task history yet.</p>
          ) : (
            history.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
                <p className="font-medium text-sm text-gray-900 dark:text-white">{item.task_title}</p>
                <p className="text-xs text-gray-500 dark:text-white/65">{item.category} • {item.status}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
