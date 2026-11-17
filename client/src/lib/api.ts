import axios from 'axios';

// Session lives in HttpOnly cookies set by the server. No token in localStorage or URLs.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let refreshing: Promise<void> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original: any = err.config;
    const status = err.response?.status;

    if (status === 401 && original && !original._retry && !String(original.url || '').includes('/auth/refresh')) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = api.post('/auth/refresh')
            .then(() => undefined)
            .finally(() => { refreshing = null; });
        }
        await refreshing;
        return api(original);
      } catch {
        window.dispatchEvent(new Event('ems:session-expired'));
        return Promise.reject(err);
      }
    }

    if (status === 403) {
      const data = err.response?.data || {};
      if (data.code === 'PASSWORD_CHANGE_REQUIRED') {
        window.dispatchEvent(new Event('ems:password-change-required'));
      } else {
        window.dispatchEvent(new CustomEvent('ems:forbidden', {
          detail: { message: data.message || 'You do not have permission to perform this action.' },
        }));
      }
    }
    return Promise.reject(err);
  }
);

export const storageUrl = (relativePath?: string | null) => {
  if (!relativePath) return '';
  return `/storage/${relativePath.replace(/^\/+/, '')}`;
};

export default api;
