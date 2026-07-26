import axios from 'axios';

// ─── Axios client ─────────────────────────────────
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// ─── Attach token ─────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Token refresh logic ──────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefresh } = data.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefresh);

        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        original.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        return api(original);
      } catch (err) {
        processQueue(err, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ─── AUTH ─────────────────────────────────────────
export const authApi = {
  signup: (data: any) => api.post('/auth/signup', data),
  login: (data: any) => api.post('/auth/login', data),
  refresh: (refreshToken: string) => api.post('/api/auth/refresh', { refreshToken }),
  logout: () => Promise.resolve({ data: { success: true } }),
  me: () => api.get('/auth/me'),
};

// ─── REPORTS ──────────────────────────────────────
export const reportsApi = {
  create: (data: any) => api.post('/reports', data),
  list: (params?: any) => api.get('/reports', { params }),
  convert: (id: string, data: any) => api.post(`/reports/${id}/convert`, data),
  centralInsights: (params?: { city?: string }) => api.get('/reports/central/insights', { params }),
};

// ─── TASKS ────────────────────────────────────────
export const tasksApi = {
  create: (data: any) => api.post('/tasks', data),
  list: (params?: any) => api.get('/tasks', { params }),
  getById: (id: string) => api.get(`/tasks/${id}`),
  getMap: () => api.get('/tasks/map'),
  getMatches: (id: string, params?: any) =>
    api.get(`/tasks/${id}/matches`, { params }),
  updateStatus: (id: string, status: string) =>
    api.put(`/tasks/${id}/status`, { status }),
  autoAssign: (id: string) =>
    api.post(`/tasks/${id}/auto-assign`),
  getInsights: (params?: any) =>
    api.get('/tasks/insights', { params }),
  requestJoin: (id: string, message?: string) => api.post(`/tasks/${id}/join-request`, { message }),
  setLeader: (id: string, volunteer_id: string) => api.put(`/tasks/${id}/leader`, { volunteer_id }),
  startSession: (data: any) => api.post('/tasks/start-session', data),
  endSession: (data: any) => api.post('/tasks/end-session', data),
};

// ─── ASSIGNMENTS ─────────────────────────────────
export const assignmentsApi = {
  create: (data: any) => api.post('/assignments', data),
  list: (params?: any) => api.get('/assignments', { params }),
  accept: (id: string) => api.put(`/assignments/${id}/accept`),
  reject: (id: string, reason: string) => api.put(`/assignments/${id}/reject`, { reason }),
  complete: (id: string, data?: any) =>
    api.put(`/assignments/${id}/complete`, data),
};

// ─── VOLUNTEERS ──────────────────────────────────
export const volunteersApi = {
  list: (params?: any) => api.get('/volunteers', { params }),
  getById: (id: string) => api.get(`/volunteers/${id}`),
  getMap: () => api.get('/volunteers/map'),
  updateProfile: (data: any) => api.put('/volunteers/profile', data),
};

export const ngosApi = {
  getMap: () => api.get('/ngos/map'),
};

export const matchApi = {
  nearby: (params: any) => api.get('/match/nearby', { params }),
};

// ─── SOS ──────────────────────────────────────────
export const sosApi = {
  trigger: (data: { lat: number; lng: number; user_id: string; emergency_details?: string }) => api.post('/sos', data),
  sendOfflineSms: (data: { lat: number; lng: number; user_id: string; phones?: string[] }) =>
    api.post('/sos/sms', data),
  acknowledge: (data: { sos_id: string; user_id: string; responder_id: string; responder_name?: string; message?: string }) =>
    api.post('/sos/ack', data),
};

// ─── DASHBOARD ───────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getWeeklySummary: () => api.get('/dashboard/weekly-summary'),
  getVolunteerStats: () => api.get('/dashboard/volunteer-stats'),
};

export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  respond: (id: string, action: 'accept' | 'reject', message?: string) =>
    api.put(`/notifications/${id}/respond`, { action, message }),
};

export { api };