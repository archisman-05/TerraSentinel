'use client';

import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { MapPin, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useSosStore } from '@/features/sos/store/sosStore';
import { useAuthStore } from '@/store/authStore';
import { sosApi } from '@/lib/api';

export function SOSAlertModal() {
  const user = useAuthStore((s) => s.user);
  const activeAlert = useSosStore((s) => s.activeAlert);
  const open = useSosStore((s) => s.alertModalOpen);
  const close = useSosStore((s) => s.closeAlertModal);
  const clear = useSosStore((s) => s.clearAlert);

  const roleLabel = useMemo(() => {
    if (!user) return 'Responder';
    return user.role === 'admin' ? 'NGO' : 'Volunteer';
  }, [user]);

  const acknowledge = async () => {
    if (!activeAlert || !user) return;
    try {
      await sosApi.acknowledge({
        sos_id: activeAlert.id,
        user_id: activeAlert.user_id,
        responder_id: user.id,
        responder_name: user.full_name,
        message: `${user.full_name} is responding to this emergency.`,
      });
      toast.success('SOS acknowledged. Requester has been notified.');
    } catch {
      toast.error('Failed to acknowledge SOS');
    }
  };

  if (!activeAlert) return null;

  return (
    <Modal
      open={open}
      onClose={close}
      title="SOS Alert"
      description={`Incoming emergency alert for nearby ${roleLabel.toLowerCase()} response.`}
      aria-label="SOS alert modal"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              toast('Alert dismissed (you can still view it on the map).', { duration: 2500 });
              close();
            }}
          >
            Dismiss
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              acknowledge();
              clear();
              toast.success('Marked as handled on your screen.', { duration: 2500 });
            }}
            data-autofocus
          >
            Acknowledge & respond
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="card-glass p-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-600/10 text-red-600 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white">Immediate action required</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-white/70">
              Coordinate with nearby responders and confirm assistance as soon as possible.
            </div>
          </div>
        </div>

        <div className="card-glass p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
            <MapPin className="h-4 w-4 text-brand-600" />
            Coordinates
          </div>
          <div className="mt-2 text-sm text-gray-700 dark:text-white/80">
            <div>
              Lat: <span className="font-mono">{activeAlert.lat.toFixed(6)}</span>
            </div>
            <div>
              Lng: <span className="font-mono">{activeAlert.lng.toFixed(6)}</span>
            </div>
          </div>
        </div>
        {activeAlert.emergency_details && (
          <div className="card-glass p-4">
            <div className="text-sm font-semibold text-gray-800 dark:text-white">Emergency details</div>
            <p className="mt-2 text-sm text-gray-700 dark:text-white/80 whitespace-pre-wrap">
              {activeAlert.emergency_details}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

