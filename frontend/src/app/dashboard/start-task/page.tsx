'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Camera, CheckCircle2, QrCode, ScanLine, StopCircle, CircleCheckBig } from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { useAuthStore } from '@/store/authStore';
import { assignmentsApi, tasksApi } from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';

const qrSeed = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
type Stage = 'setup' | 'started' | 'end_scan' | 'completed';
type Session = {
  stage: Stage;
  taskLabel: string;
  startGeo: string;
  endGeo: string;
  startScanToken: string;
  endScanToken: string;
  leaderSelfie?: string;
  groupPhoto?: string;
};

export default function StartTaskPage() {
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState<'leader' | 'member' | null>(null);
  const storageKey = `leader-task-session-${user?.id || 'anon'}`;
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [stage, setStage] = useState<Stage>('setup');
  const [leaderSelfieGeo, setLeaderSelfieGeo] = useState<string>('');
  const [groupGeo, setGroupGeo] = useState<string>('');
  const [leaderSelfieDataUrl, setLeaderSelfieDataUrl] = useState<string>('');
  const [groupPhotoDataUrl, setGroupPhotoDataUrl] = useState<string>('');
  const [volunteerCount, setVolunteerCount] = useState(1);
  const [startTokens, setStartTokens] = useState<string[]>([]);
  const [endTokens, setEndTokens] = useState<string[]>([]);
  const memberCode = useMemo(() => `VOL-${user?.id || 'anon'}-${qrSeed()}`, [user?.id]);
  const [memberQrDataUrl, setMemberQrDataUrl] = useState<string>('');
  const [scannerRound, setScannerRound] = useState(1);

  const assignmentsQ = useQuery({
    queryKey: ['start-task-assignments', user?.id],
    queryFn: () => assignmentsApi.list({ volunteer_id: user?.id, limit: 50 }).then((r) => r.data.data.assignments || []),
    enabled: !!user?.id,
  });

  const assignments = assignmentsQ.data || [];
  const leaderTasks = assignments.filter((a: any) => a.task_leader_id === user?.id);
  const memberTasks = assignments.filter((a: any) => a.task_leader_id !== user?.id);
  const resolvedRoleMode: 'leader' | 'member' | null = leaderTasks.length > 0 ? 'leader' : memberTasks.length > 0 ? 'member' : null;
  const selectedTask = assignments.find((a: any) => a.task_id === selectedTaskId) || null;

  useEffect(() => {
    if (!resolvedRoleMode) return;
    setMode(resolvedRoleMode);
  }, [resolvedRoleMode]);

  useEffect(() => {
    if (!selectedTaskId) {
      if (resolvedRoleMode === 'leader' && leaderTasks[0]?.task_id) setSelectedTaskId(leaderTasks[0].task_id);
      if (resolvedRoleMode === 'member' && memberTasks[0]?.task_id) setSelectedTaskId(memberTasks[0].task_id);
    }
  }, [resolvedRoleMode, leaderTasks, memberTasks, selectedTaskId]);

  const captureGeoTag = async (setter: (value: string) => void) => {
    if (!navigator.geolocation) {
      setter('unavailable');
      toast.error('Geolocation unavailable. Continuing without coordinates.');
      return;
    }

    const getPosition = () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        });
      });

    try {
      const pos = await getPosition();
      setter(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
      toast.success('Geotag captured.');
    } catch {
      // CoreLocation can intermittently return "location unknown"; one retry avoids false failures.
      try {
        const pos = await getPosition();
        setter(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
        toast.success('Geotag captured.');
      } catch (err: any) {
        setter('unavailable');
        const code = typeof err?.code === 'number' ? err.code : -1;
        if (code === 1) {
          toast.error('Location permission denied. Continuing without coordinates.');
        } else if (code === 3) {
          toast.error('Location timed out. Continuing without coordinates.');
        } else {
          toast.error('Location unavailable right now. Continuing without coordinates.');
        }
      }
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Session;
      setStage(parsed.stage);
      setSelectedTaskId(parsed.taskLabel || '');
      setLeaderSelfieGeo(parsed.startGeo || '');
      setGroupGeo(parsed.endGeo || '');
      setStartTokens(parsed.startScanToken ? JSON.parse(parsed.startScanToken) : []);
      setEndTokens(parsed.endScanToken ? JSON.parse(parsed.endScanToken) : []);
      setLeaderSelfieDataUrl(parsed.leaderSelfie || '');
      setGroupPhotoDataUrl(parsed.groupPhoto || '');
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    const payload: Session = {
      stage,
      taskLabel: selectedTaskId,
      startGeo: leaderSelfieGeo,
      endGeo: groupGeo,
      startScanToken: JSON.stringify(startTokens),
      endScanToken: JSON.stringify(endTokens),
      leaderSelfie: leaderSelfieDataUrl || undefined,
      groupPhoto: groupPhotoDataUrl || undefined,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [stage, selectedTaskId, leaderSelfieGeo, groupGeo, startTokens, endTokens, leaderSelfieDataUrl, groupPhotoDataUrl, storageKey]);

  const startMut = useMutation({
    mutationFn: () =>
      tasksApi.startSession({
        task_id: selectedTaskId,
        selfie_image: leaderSelfieDataUrl,
        selfie_geo: leaderSelfieGeo,
        expected_volunteers: volunteerCount,
        scanned_tokens: startTokens,
      }),
  });

  const endMut = useMutation({
    mutationFn: () =>
      tasksApi.endSession({
        task_id: selectedTaskId,
        group_image: groupPhotoDataUrl,
        group_geo: groupGeo,
        scanned_tokens: endTokens,
      }),
  });

  useEffect(() => {
    const qrPayload = JSON.stringify({
      type: 'member-attendance',
      token: memberCode,
      generated_at: new Date().toISOString(),
    });
    QRCode.toDataURL(qrPayload, { margin: 1, width: 280 })
      .then(setMemberQrDataUrl)
      .catch(() => toast.error('Failed to generate QR code'));
  }, [memberCode]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Start Task</h1>
          <p className="text-sm text-gray-500 dark:text-white/65">
            Attendance workflow with QR scans and geotagged camera captures.
          </p>
        </div>

        {!mode && <div className="card p-4 text-sm text-gray-600">No active task assignment found for your account.</div>}

        {mode === 'leader' && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Leader Flow</h2>
            <p className="text-xs text-gray-500">You are selected as leader by admin for these tasks.</p>
            <select className="input" value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
              {leaderTasks.map((t: any) => (
                <option key={t.task_id} value={t.task_id}>{t.task_title}</option>
              ))}
            </select>
            <div>
              <label className="label">Number of volunteers in group</label>
              <input
                type="number"
                min={1}
                max={50}
                className="input"
                value={volunteerCount}
                onChange={(e) => setVolunteerCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            {stage === 'setup' && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button className="btn-secondary" onClick={() => captureGeoTag(setLeaderSelfieGeo)}>
                    <Camera className="w-4 h-4" /> Capture Leader Selfie Geotag
                  </button>
                  <p className="text-sm text-gray-600 dark:text-white/70 break-all">{leaderSelfieGeo || 'No geotag captured yet.'}</p>
                </div>
                <div>
                  <label className="label">Leader Selfie (direct camera capture)</label>
                  <CameraCapture
                    cameraMode="user"
                    onCapture={setLeaderSelfieDataUrl}
                    emptyLabel="Start camera and capture selfie directly."
                  />
                </div>
                <div>
                  <label className="label">First QR scan (mark start attendance)</label>
                  <QrScanner
                    scannerKey={`start-${scannerRound}`}
                    active={startTokens.length < volunteerCount}
                    onScan={(decoded) => {
                      if (!leaderSelfieGeo || !leaderSelfieDataUrl) {
                        toast.error('Capture selfie + geotag first.');
                        return;
                      }
                      setStartTokens((prev) => {
                        if (prev.includes(decoded)) return prev;
                        const next = [...prev, decoded];
                        if (next.length >= volunteerCount) {
                          startMut.mutate(undefined, {
                            onSuccess: () => {
                              setStage('started');
                              toast.success('Success! Task started.');
                            },
                            onError: () => toast.error('Failed to save start session'),
                          });
                        }
                        return next;
                      });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">{startTokens.length}/{volunteerCount} scanned</p>
                </div>
              </>
            )}

            {stage === 'started' && (
              <div className="rounded-xl border border-green-300/60 bg-green-50/80 dark:bg-green-500/10 dark:border-green-400/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-semibold">
                  <CircleCheckBig className="w-5 h-5" /> Success
                </div>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Task started for <span className="font-semibold">{selectedTask?.task_title || 'this task'}</span>. First attendance scan is saved.
                </p>
                <button className="btn-primary" onClick={() => setStage('end_scan')}>
                  Proceed to End Task
                </button>
              </div>
            )}

            {stage === 'end_scan' && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button className="btn-secondary" onClick={() => captureGeoTag(setGroupGeo)}>
                    <Camera className="w-4 h-4" /> Capture Group Photo Geotag
                  </button>
                  <p className="text-sm text-gray-600 dark:text-white/70 break-all">{groupGeo || 'No group geotag captured yet.'}</p>
                </div>
                <div>
                  <label className="label">Group Photo (direct camera capture)</label>
                  <CameraCapture
                    cameraMode="environment"
                    onCapture={setGroupPhotoDataUrl}
                    emptyLabel="Start camera and capture group photo directly."
                  />
                </div>
                <div>
                  <label className="label">Second QR scan (mark work end)</label>
                  <QrScanner
                    scannerKey={`end-${scannerRound}`}
                    active={endTokens.length < volunteerCount}
                    onScan={(decoded) => {
                      if (!groupGeo || !groupPhotoDataUrl) {
                        toast.error('Capture group photo + geotag first.');
                        return;
                      }
                      setEndTokens((prev) => {
                        if (prev.includes(decoded)) return prev;
                        const next = [...prev, decoded];
                        if (next.length >= volunteerCount) {
                          endMut.mutate(undefined, {
                            onSuccess: () => {
                              setStage('completed');
                              toast.success('Task closed successfully.');
                            },
                            onError: () => toast.error('Failed to save end session'),
                          });
                        }
                        return next;
                      });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">{endTokens.length}/{volunteerCount} scanned</p>
                </div>
              </>
            )}

            {stage === 'completed' && (
              <div className="rounded-xl border border-brand-300/60 bg-brand-50/70 dark:bg-brand-500/10 dark:border-brand-400/30 p-4 space-y-2">
                <p className="font-semibold text-brand-700 dark:text-brand-200">Task lifecycle completed</p>
                <p className="text-sm text-brand-700/90 dark:text-brand-200/85">Start and end scans are both verified.</p>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    localStorage.removeItem(storageKey);
                    setStage('setup');
                    setLeaderSelfieGeo('');
                    setGroupGeo('');
                    setLeaderSelfieDataUrl('');
                    setGroupPhotoDataUrl('');
                    setStartTokens([]);
                    setEndTokens([]);
                    setScannerRound((v) => v + 1);
                  }}
                >
                  Start New Task Session
                </button>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 space-y-1">
              {(startTokens.length + endTokens.length) === 0 ? <p className="text-sm text-gray-500 dark:text-white/65">No scans yet.</p> : (
                <>
                  {startTokens.map((s, i) => <p key={`s-${s}`} className="text-sm text-gray-700">Start {i + 1}: {s}</p>)}
                  {endTokens.map((s, i) => <p key={`e-${s}`} className="text-sm text-gray-700">End {i + 1}: {s}</p>)}
                </>
              )}
            </div>
          </div>
        )}

        {mode === 'member' && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Member Flow</h2>
            <p className="text-xs text-gray-500">You are a member. Leader mode is only available to selected leaders.</p>
            <select className="input" value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
              {memberTasks.map((t: any) => (
                <option key={t.task_id} value={t.task_id}>{t.task_title}</option>
              ))}
            </select>
            <p className="text-sm text-gray-600 dark:text-white/70">
              Show this one-time token QR equivalent to leader at start and completion.
            </p>
            <div className="rounded-xl bg-gray-100 dark:bg-white/10 p-4">
              <p className="text-xs text-gray-500 dark:text-white/65">Member one-time code</p>
              <p className="font-mono text-lg font-semibold text-gray-900 dark:text-white">{memberCode}</p>
              {memberQrDataUrl ? (
                <img
                  src={memberQrDataUrl}
                  alt="Member attendance QR code"
                  className="mt-3 rounded-lg border border-gray-300 dark:border-white/15 w-56 h-56 bg-white p-2"
                />
              ) : (
                <p className="text-xs text-gray-500 dark:text-white/60 mt-2">Generating QR...</p>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-white/60 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> After first scan, reuse same token to close work time.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function CameraCapture({
  cameraMode,
  onCapture,
  emptyLabel,
}: {
  cameraMode: 'user' | 'environment';
  onCapture: (dataUrl: string) => void;
  emptyLabel: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOn(false);
  };

  const startCamera = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraMode },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play();
      }
      setStream(media);
      setCameraOn(true);
    } catch {
      toast.error('Unable to access camera');
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg', 0.9));
    toast.success('Photo captured.');
  };

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-black/60 overflow-hidden">
        <video ref={videoRef} className="w-full max-h-64 object-cover" muted playsInline />
      </div>
      {!cameraOn && <p className="text-xs text-gray-500 dark:text-white/60">{emptyLabel}</p>}
      <div className="flex gap-2">
        {!cameraOn ? (
          <button type="button" className="btn-secondary" onClick={startCamera}>
            <Camera className="w-4 h-4" /> Start Camera
          </button>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={captureFrame}>
              <Camera className="w-4 h-4" /> Capture
            </button>
            <button type="button" className="btn-secondary" onClick={stopCamera}>
              <StopCircle className="w-4 h-4" /> Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function QrScanner({ onScan, active, scannerKey }: { onScan: (value: string) => void; active: boolean; scannerKey: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const seenRef = useRef<Record<string, number>>({});

  const stopScanner = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsRunning(false);
  };

  const startScanner = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = media;
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play();
      }
      setIsRunning(true);
    } catch {
      toast.error('Unable to start QR scanner camera');
    }
  };

  useEffect(() => {
    if (!isRunning || !active) return;
    let rafId = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const tick = () => {
      const video = videoRef.current;
      if (!video || !ctx || video.readyState < 2) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height);
      if (decoded?.data) {
        const now = Date.now();
        const lastSeen = seenRef.current[decoded.data] || 0;
        if (now - lastSeen > 1500) {
          seenRef.current[decoded.data] = now;
          onScan(decoded.data);
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isRunning, active, onScan]);

  useEffect(() => {
    return () => stopScanner();
  }, []);

  useEffect(() => {
    seenRef.current = {};
  }, [scannerKey]);

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-black/70 overflow-hidden">
        <video ref={videoRef} className="w-full max-h-64 object-cover" muted playsInline />
      </div>
      <div className="flex gap-2">
        {!isRunning ? (
          <button type="button" className="btn-secondary" onClick={startScanner}>
            <ScanLine className="w-4 h-4" /> Start Scanner
          </button>
        ) : (
          <button type="button" className="btn-secondary" onClick={stopScanner}>
            <StopCircle className="w-4 h-4" /> Stop Scanner
          </button>
        )}
      </div>
    </div>
  );
}
