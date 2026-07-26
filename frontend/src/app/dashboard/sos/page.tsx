'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { SOSFloatingButton } from '@/features/sos/components/SOSFloatingButton';

export default function SosPage() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Emergency SOS</h1>
          <p className="text-sm text-gray-500 dark:text-white/65">
            Trigger an emergency alert to nearby volunteers and NGOs.
          </p>
        </div>

        <div className="card p-6">
          <p className="text-sm text-gray-700 dark:text-white/75 mb-4">
            Use this action only for real emergencies. Your location will be shared with nearby responders.
          </p>
          <SOSFloatingButton inline />
        </div>
      </div>
    </DashboardLayout>
  );
}
