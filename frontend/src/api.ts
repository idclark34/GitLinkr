import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000',
  withCredentials: true,
});

// Attach token from localStorage (if present)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gh_token');
  // Only attach Authorization for real GitHub tokens to avoid 401s for local users
  if (token && /^gh[a-z]_/.test(token)) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    } as any;
  }
  return config;
});

export default api;
