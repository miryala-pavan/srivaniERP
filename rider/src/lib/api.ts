import axios from 'axios';
import { getToken, clearToken } from './storage';

// Same shape as frontend/src/lib/api.ts (axios + bearer-token interceptor),
// with the token source routed through storage.ts's web/native abstraction
// instead of bare localStorage.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err?.response?.status === 401) {
      await clearToken();
      if (typeof window !== 'undefined') window.location.reload();
    }
    return Promise.reject(err);
  },
);

export default api;
