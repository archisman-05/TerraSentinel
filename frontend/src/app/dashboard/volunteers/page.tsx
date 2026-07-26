'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { volunteersApi } from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { MapPin, Star, Loader2, Search } from 'lucide-react';

export default function VolunteersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['volunteers', availability],
    queryFn: () =>
      volunteersApi
        .list({ availability: availability || undefined, limit: 50 })
        .then((r) => r.data.data.volunteers),
    refetchInterval: 30_000,
  });

  const filtered = (data || []).filter((v: Record<string, unknown>) =>
    !search || (v.full_name as string)?.toLowerCase().includes(search.toLowerCase()) ||
    (v.skills as string[])?.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Volunteers</h1>
            <p className="text-sm text-gray-500 dark:text-white/60">{filtered.length} registered</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9 w-52"
                placeholder="Search by name or skill…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input w-auto" value={availability} onChange={e => setAvailability(e.target.value)}>
              <option value="">All</option>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="card-glass p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : isError ? (
          <div className="card-glass p-6 text-sm text-red-600 dark:text-red-300">
            Failed to load volunteers.
            <div className="text-xs text-red-500 dark:text-red-300/80 mt-1 break-words">
              {(error as any)?.message || 'Unknown error'}
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((vol: Record<string, unknown>) => (
              <button
                type="button"
                key={vol.id as string}
                onClick={() => router.push(`/admin/volunteers/${vol.id as string}`)}
                className="card-glass w-full p-4 text-left hover:shadow-xl transition-all duration-300 ease-in-out active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    {(vol.full_name as string)?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold text-sm truncate text-gray-900 dark:text-white">{vol.full_name as string}</p>
                      <span className={`badge flex-shrink-0 ${vol.availability === 'available' ? 'bg-green-100 text-green-700' :
                          vol.availability === 'busy' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-500'
                        }`}>
                        {vol.availability as string}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-white/60">
                      {typeof vol.city === 'string' && vol.city.trim().length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {vol.city}
                        </span>
                      )}
                      {typeof vol.rating === 'number' && Number.isFinite(vol.rating) ? (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          {(vol.rating as number).toFixed(1)}
                        </span>
                      ) : null}
                      <span>{vol.total_tasks_done as number} tasks</span>
                    </div>
                  </div>
                </div>

                {(vol.skills as string[])?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(vol.skills as string[]).slice(0, 4).map((s) => (
                      <span key={s} className="badge bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">{s}</span>
                    ))}
                    {(vol.skills as string[]).length > 4 && (
                      <span className="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/70">+{(vol.skills as string[]).length - 4}</span>
                    )}
                  </div>
                )}

                {typeof vol.bio === 'string' && vol.bio.trim().length > 0 && (
                  <p className="text-xs text-gray-600 dark:text-white/65 mt-2 line-clamp-2">{vol.bio}</p>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-3 card-glass p-12 text-center text-gray-500 dark:text-white/60">No volunteers found.</div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
