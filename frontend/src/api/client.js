import axios from 'axios';
import { auth } from '../lib/firebase.js';

let onUnauthorized = () => {};

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
export { API_BASE_URL };

const client = axios.create({ baseURL: API_BASE_URL });

client.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) config.headers.Authorization = `Bearer ${await user.getIdToken()}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const user = auth.currentUser;
    if (error.response?.status === 401 && user && !original._retried) {
      original._retried = true;
      try {
        original.headers.Authorization = `Bearer ${await user.getIdToken(true)}`;
        return await client(original);
      } catch (retryErr) {
        if (retryErr.response?.status === 401) onUnauthorized();
        return Promise.reject(retryErr);
      }
    }
    return Promise.reject(error);
  }
);

export default client;
