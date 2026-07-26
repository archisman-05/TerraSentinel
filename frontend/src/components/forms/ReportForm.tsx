'use client';

import { useState } from 'react';
import { reportsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { MapPin, AlertTriangle, Loader2, Sparkles } from 'lucide-react';

const CATEGORIES = ['food','health','shelter','education','water','sanitation','mental_health','disaster_relief','other'];
const URGENCIES  = ['low','medium','high','critical'];

interface AIAnalysis {
  summary?:         string;
  urgency?:         string;
  urgency_reason?:  string;
  required_skills?: string[];
  key_concerns?:    string[];
  recommended_action?: string;
}

export default function ReportForm({ onSuccess }: { onSuccess?: () => void }) {
  const [form, setForm]         = useState({ title:'', description:'', category:'food', urgency:'medium', latitude:'', longitude:'', address:'' });
  const [submitting, setSubmitting] = useState(false);
  const [aiResult,   setAiResult]   = useState<AIAnalysis | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const detectLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported');
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setGeoLoading(false);
        toast.success('Location detected');
      },
      () => { setGeoLoading(false); toast.error('Could not detect location'); }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.latitude || !form.longitude) return toast.error('Please set your location');
    if (!form.address.trim()) return toast.error('Please enter the location/address');

    setSubmitting(true);
    try {
      const res = await reportsApi.create(form);
      setAiResult(res.data.data.ai_analysis);
      toast.success('Report submitted! AI is analysing…');
      onSuccess?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Submission failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (aiResult) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="flex items-center gap-2 text-brand-700">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-semibold">AI Analysis Complete</h3>
        </div>

        <div className="card p-4 space-y-3">
          {aiResult.summary && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-white/60 uppercase tracking-wide mb-1">Summary</p>
              <p className="text-sm text-gray-800 dark:text-white/85">{aiResult.summary}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-white/60 uppercase tracking-wide mb-1">Urgency Detected</p>
              <span className={`badge-${aiResult.urgency}`}>{aiResult.urgency?.toUpperCase()}</span>
              {aiResult.urgency_reason && <p className="text-xs text-gray-500 dark:text-white/65 mt-1">{aiResult.urgency_reason}</p>}
            </div>
            {aiResult.required_skills?.length ? (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-white/60 uppercase tracking-wide mb-1">Skills Needed</p>
                <div className="flex flex-wrap gap-1">
                  {aiResult.required_skills.map(s => (
                    <span key={s} className="badge bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">{s}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {aiResult.recommended_action && (
            <div className="bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-400/20 rounded-lg p-3">
              <p className="text-xs font-medium text-brand-700 dark:text-brand-200 mb-0.5">Recommended Action</p>
              <p className="text-sm text-brand-800 dark:text-brand-100">{aiResult.recommended_action}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setAiResult(null)}>Submit Another</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <div>
        <label className="label">Title *</label>
        <input
          className="input" required
          placeholder="Brief description of the issue"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />
      </div>

      <div>
        <label className="label">Description *</label>
        <textarea
          className="input min-h-[100px] resize-none" required
          placeholder="Describe the situation in detail…"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category *</label>
          <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Urgency *</label>
          <select className="input" value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
            {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Location *</label>
        <div className="flex gap-2 mb-2">
          <input
            className="input flex-1" placeholder="Latitude"
            value={form.latitude}
            onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
          />
          <input
            className="input flex-1" placeholder="Longitude"
            value={form.longitude}
            onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
          />
        </div>
        <button type="button" className="btn-secondary text-xs w-full" onClick={detectLocation} disabled={geoLoading}>
          {geoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
          {geoLoading ? 'Detecting…' : 'Auto-detect my location'}
        </button>
        {form.latitude && form.longitude && (
          <div className="mt-2 rounded-lg border border-gray-200 dark:border-white/15 overflow-hidden h-40">
            <iframe
              title="Report location preview"
              className="w-full h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(form.latitude)},${encodeURIComponent(form.longitude)}&z=14&output=embed`}
            />
          </div>
        )}
      </div>

      <div>
        <label className="label">Address / Area Name *</label>
        <input
          className="input" placeholder="Street address or area name" required
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
        />
      </div>

      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-300/20 rounded-lg p-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-200">
          Your report will be analysed by AI to classify urgency and recommend volunteers automatically.
        </p>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {submitting ? 'Submitting & Analysing…' : 'Submit Report'}
      </button>
    </form>
  );
}
