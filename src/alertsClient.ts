const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');

export async function alertsFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const make = (token: string | null) => fetch(API + path, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }
  });
  let response = await make(sessionStorage.getItem('kh_access'));
  if (response.status === 401) {
    const refreshToken = sessionStorage.getItem('kh_refresh');
    if (refreshToken) {
      const refresh = await fetch(API + '/api/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken })
      });
      const data = await refresh.json().catch(() => ({})) as { accessToken?: string; refreshToken?: string };
      if (refresh.ok && data.accessToken) {
        sessionStorage.setItem('kh_access', data.accessToken);
        if (data.refreshToken) sessionStorage.setItem('kh_refresh', data.refreshToken);
        response = await make(data.accessToken);
      }
    }
  }
  return response;
}
