import axios from 'axios';
import { supabase } from '../lib/supabase.js';

let onUnauthorized = () => {};

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : '/api';
const client = axios.create({ baseURL: API_BASE_URL });

client.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  if (data.session) config.headers.Authorization = `Bearer ${data.session.access_token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;
      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !data.session) throw refreshError || new Error('No session to refresh.');
        original.headers.Authorization = `Bearer ${data.session.access_token}`;
        return await client(original);
      } catch (retryErr) {
        onUnauthorized();
        return Promise.reject(retryErr);
      }
    }
    return Promise.reject(error);
  }
);

export default client;
