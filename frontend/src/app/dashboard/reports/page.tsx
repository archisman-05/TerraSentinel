'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ReportForm from '@/components/forms/ReportForm';
import { Plus, X, MapPin, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  address?: string;
  city?: string;
  ai_summary?: string;
  is_converted: boolean;
  created_at: string;
}

export default function ReportsPage() {
  const qc = useQueryClient();
  const [showForm,   setShowForm]   = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn:  () => reportsApi.list({ limit: 20, page: 1 }).then(r => r.data.data),
    refetchInterval: 30_000,
  });

  const convertMut = useMutation({
    mutationFn: (id: string) => reportsApi.convert(id, { required_skills: [], required_volunteers: 1 }),
    onSuccess: () => {
      toast.success('Report converted to task!');
      qc.invalidateQueries({ queryKey: ['reports'] });
      setConverting(null);
    },
    onError: () => {
      toast.error('Conversion failed');
      setConverting(null);
    },
  });

  const reports: Report[] = data?.reports ?? [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Community Reports</h1>
            <p className="text-sm text-gray-500 dark:text-white/65">Incoming issues from the community</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> New Report
          </button>
        </div>

        {/* New Report Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="rounded-2xl border border-white/20 dark:border-white/10 bg-white dark:bg-ink-950 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10">
                <h2 className="font-bold text-gray-900 dark:text-white">Submit Community Report</h2>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-white/70">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5">
                <ReportForm onSuccess={() => { setShowForm(false); refetch(); }} />
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`badge-${report.urgency}`}>{report.urgency}</span>
                      <span className="badge bg-gray-100 text-gray-600">
                        {report.category.replace('_', ' ')}
                      </span>
                      {report.is_converted && (
                        <span className="badge bg-green-100 text-green-700">✓ Converted</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{report.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-white/65 mt-0.5 line-clamp-2">{report.description}</p>

                    {report.ai_summary && (
                      <div className="mt-2 flex items-start gap-1.5 bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-400/20 rounded-lg p-2">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-purple-700 dark:text-purple-200">{report.ai_summary}</p>
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-white/60">
                      {(report.address || report.city) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {report.address ?? report.city}
                        </span>
                      )}
                      <span>{new Date(report.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {!report.is_converted && (
                    <button
                      className="btn-secondary text-xs flex-shrink-0"
                      onClick={() => {
                        setConverting(report.id);
                        convertMut.mutate(report.id);
                      }}
                      disabled={convertMut.isPending && converting === report.id}
                    >
                      {convertMut.isPending && converting === report.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      Convert to Task
                    </button>
                  )}
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="card p-12 text-center text-gray-400">
                No reports yet. Submit the first one!
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
