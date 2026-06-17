import axios from 'axios';
import toast from 'react-hot-toast';
import { isNetworkError } from './errors';

let lastNetworkToast = 0;

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('srivani_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function silentRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const token = localStorage.getItem('srivani_token');
      if (!token) return false;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) return false;

      const data = await response.json();
      localStorage.setItem('srivani_token', data.access_token);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // Server unreachable / network failure — surface a clear message (debounced
    // so a burst of failed requests doesn't spam identical toasts).
    if (isNetworkError(error) && typeof window !== 'undefined') {
      const now = Date.now();
      if (now - lastNetworkToast > 4000) {
        lastNetworkToast = now;
        toast.error('Cannot reach the server. Please check that it is running.');
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && typeof window !== 'undefined' && !error.config?.url?.includes('/auth/login')) {
      const refreshed = await silentRefresh();

      if (refreshed) {
        const token = localStorage.getItem('srivani_token');
        error.config.headers['Authorization'] = `Bearer ${token}`;
        return api.request(error.config);
      }

      localStorage.removeItem('srivani_token');
      localStorage.removeItem('srivani_user');
      alert('Your session has expired. Please login again.');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
export { silentRefresh };
