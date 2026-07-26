'use client';

import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Siren } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { sosApi } from '@/lib/api';

type LatLng = { lat: number; lng: number };

async function getLocation(): Promise<LatLng> {
  if (!navigator.geolocation) throw new Error('Geolocation is not supported on this device.');
  const getPosition = (options: PositionOptions) =>
    new Promise<LatLng>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        options
      );
    });

  try {
    return await getPosition({ enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 });
  } catch (err: any) {
    // Retry once with relaxed settings so weak GPS does not block SOS.
    try {
      return await getPosition({ enableHighAccuracy: false, maximumAge: 120_000, timeout: 15_000 });
    } catch (err2: any) {
      if (err2?.code === 1) {
        throw new Error('Location permission is blocked. Please allow location access in your browser.');
      }
      if (err2?.code === 3) {
        throw new Error('Location request timed out. Move to open sky/network and retry.');
      }
      throw new Error(err2?.message || err?.message || 'Unable to get your location.');
    }
  }
}

export function SOSFloatingButton({ inline = false }: { inline?: boolean }) {
  const user = useAuthStore((s) => s.user);

  const userId = useMemo(() => user?.id ?? 'anonymous', [user?.id]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [emergencyDetails, setEmergencyDetails] = useState('');

  const trigger = useCallback(async () => {
    if (emergencyDetails.trim().length < 10) {
      toast.error('Please add emergency details (at least 10 characters).');
      return;
    }
    setSending(true);
    try {
      if (!navigator.onLine) {
        try {
          const loc = await getLocation();
          await sosApi.sendOfflineSms({ lat: loc.lat, lng: loc.lng, user_id: userId });
          toast.success('Offline fallback SMS has been queued.', { duration: 5000 });
        } catch {
          // Intentionally ignored: keep emergency UI open for manual retry/call flow.
        }
        setConfirmOpen(false);
        setOfflineOpen(true);
        return;
      }

      const loc = await getLocation();
      await sosApi.trigger({ lat: loc.lat, lng: loc.lng, user_id: userId, emergency_details: emergencyDetails.trim() });
      toast.success('SOS sent. Nearby responders have been alerted.', { duration: 6000 });
      setConfirmOpen(false);
      setEmergencyDetails('');
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : 'Failed to send SOS.';
      toast.error(message);
      if (!navigator.onLine) {
        setConfirmOpen(false);
        setOfflineOpen(true);
      }
    } finally {
      setSending(false);
    }
  }, [emergencyDetails, userId]);

  const sendOfflineFallback = useCallback(async () => {
    setSending(true);
    try {
      const loc = await getLocation();
      await sosApi.sendOfflineSms({ lat: loc.lat, lng: loc.lng, user_id: userId });
      toast.success('Emergency SMS fallback sent.', { duration: 6000 });
      setOfflineOpen(false);
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : 'Failed to send fallback SMS.';
      toast.error(message);
    } finally {
      setSending(false);
    }
  }, [userId]);

  return (
    <>
      {inline ? (
        <Button variant="danger" onClick={() => setConfirmOpen(true)} className="w-full sm:w-auto">
          <Siren className="h-4 w-4" />
          Trigger SOS
        </Button>
      ) : (
        <button
          onClick={() => setConfirmOpen(true)}
          className="fixed bottom-6 right-6 z-[200] h-14 w-14 rounded-2xl bg-red-600 text-white shadow-xl shadow-red-600/35 border border-white/20 animate-sos-pulse hover:bg-red-700 transition-all duration-300 ease-in-out"
          aria-label="Trigger SOS emergency alert"
        >
          <Siren className="h-6 w-6 mx-auto" />
        </button>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => (sending ? null : setConfirmOpen(false))}
        title="Confirm SOS"
        description="This will share your live location and alert nearby NGOs and volunteers immediately."
        aria-label="SOS confirmation modal"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={trigger} isLoading={sending} data-autofocus>
              Send SOS
            </Button>
          </div>
        }
      >
        <div className="text-sm text-gray-600 dark:text-white/70 space-y-3">
          <div className="card-glass p-4">
            <div className="font-semibold text-gray-900 dark:text-white">What happens next</div>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Your coordinates are sent securely to the backend.</li>
              <li>Nearby responders are notified in real time.</li>
              <li>You’ll also see incoming updates on the dashboard/map.</li>
            </ul>
          </div>
          <div className="text-xs text-gray-500 dark:text-white/55">
            If you’re offline, we’ll show emergency contacts and call options.
          </div>
          <div>
            <label className="label">Emergency details (required)</label>
            <textarea
              className="input min-h-[90px]"
              placeholder="Describe what happened, injuries, urgency, and any hazards..."
              value={emergencyDetails}
              onChange={(e) => setEmergencyDetails(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={offlineOpen}
        onClose={() => setOfflineOpen(false)}
        title="You’re offline"
        description="We can’t reach the server right now. Use the options below to get help immediately."
        aria-label="Offline SOS fallback modal"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOfflineOpen(false)} data-autofocus>
              Close
            </Button>
            <Button variant="danger" onClick={sendOfflineFallback} isLoading={sending}>
              Send SMS fallback
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="card-glass p-4">
            <div className="font-semibold text-gray-900 dark:text-white">Emergency numbers</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a className="btn-secondary justify-center" href="tel:112" aria-label="Call emergency number 112">
                Call 112
              </a>
              <a className="btn-secondary justify-center" href="tel:911" aria-label="Call emergency number 911">
                Call 911
              </a>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-white/55">
            When you regain internet, you can retry SOS to notify nearby NGOs/volunteers through the platform.
          </div>
        </div>
      </Modal>
    </>
  );
}

