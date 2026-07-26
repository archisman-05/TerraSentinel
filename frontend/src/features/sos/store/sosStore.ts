import { create } from 'zustand';

export type SosAlert = {
  id: string;
  lat: number;
  lng: number;
  user_id: string;
  created_at: string;
  emergency_details?: string;
  nearby_ngos?: Array<{ user_id: string; org_name?: string; distance_km: number }>;
  nearby_volunteers?: Array<{ user_id: string; full_name?: string; distance_km: number }>;
};

type SosState = {
  activeAlert: SosAlert | null;
  alertModalOpen: boolean;
  setAlert: (alert: SosAlert) => void;
  clearAlert: () => void;
  openAlertModal: () => void;
  closeAlertModal: () => void;
};

export const useSosStore = create<SosState>((set) => ({
  activeAlert: null,
  alertModalOpen: false,
  setAlert: (alert) => set({ activeAlert: alert, alertModalOpen: true }),
  clearAlert: () => set({ activeAlert: null, alertModalOpen: false }),
  openAlertModal: () => set({ alertModalOpen: true }),
  closeAlertModal: () => set({ alertModalOpen: false }),
}));

