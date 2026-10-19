import { useEffect, useState, type CSSProperties } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerKingsHallNativePushToken } from './nativePush';
import NowBar from './NowBar';
import IdentityPage from './Identity';
import SecurityPage from './Security';
import AlertsPage from './Alerts';
import ExternalLoginPage from './ExternalLogin';
import AboutPage from './About';
import StatisticsPage from './Statistics';
import SetupPage from './Setup';
import ExitPage from './Exit';
import { alertsFetch } from './alertsClient';
import Toast from './Toast';
import LoadingDots from './components/LoadingDots';
import type { FormEvent } from 'react';
import './App.css';
import AppUpdateMonitor from './AppUpdateMonitor';

type Mode = 'landing' | 'login' | 'request' | 'verify' | 'account' | 'home' | 'onboard' | 'review';
type HomeSection = 'HOME' | 'IDENTITY' | 'DEVICE' | 'EXTERNAL' | 'APPS' | 'SECURITY' | 'PROFILE' | 'HELP' | 'ALERTS' | 'ABOUT' | 'EXIT';
type User = { id: string; name: string; username: string; email: string; isEmailVerified: boolean };
type Result = { message?: string; error?: string; code?: string; email?: string; accessToken?: string; refreshToken?: string; user?: User };
const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');
type KingsHallAccountPlugin = {
  addAccount(options: { email: string; username: string; displayName: string; refreshToken?: string }): Promise<{ accountName: string; alreadyPresent?: boolean }>;
  restoreSession(): Promise<{ email?: string; refreshToken?: string }>;
  clearSession(options: { email?: string }): Promise<void>;
};
const DeviceAccount = registerPlugin<KingsHallAccountPlugin>('KingsHallAccount');
function readSavedBrowserAccounts(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem('kh_saved_accounts') || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim().toLowerCase()).filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)))].slice(0, 10);
  } catch { return []; }
}
function clearRemovedAccount(email: string) {
  try {
    const cookie = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith('kh_removed_accounts='));
    if (!cookie) return;
    const parsed = JSON.parse(decodeURIComponent(cookie.slice('kh_removed_accounts='.length)));
    if (Array.isArray(parsed)) {
      const remaining = parsed.filter((item): item is string => typeof item === 'string' && item.trim().toLowerCase() !== email.trim().toLowerCase());
      document.cookie = 'kh_removed_accounts=' + encodeURIComponent(JSON.stringify(remaining)) + '; Domain=.kingshall.online; Path=/; Max-Age=31536000; Secure; SameSite=Lax';
    }
  } catch {}
}
function setBrowserAccountHint(email: string) {
  // Shared browser cookies contain email hints only, never credentials.
  if (email && (window.location.hostname === 'kingshall.online' || window.location.hostname.endsWith('.kingshall.online'))) {
    document.cookie = 'kh_account_hint=' + encodeURIComponent(email.trim().toLowerCase()) + '; Domain=.kingshall.online; Path=/; Max-Age=31536000; Secure; SameSite=Lax';
  }
}
function writeBrowserAccountsCookie(accounts: string[]) {
  if (window.location.hostname !== 'kingshall.online' && !window.location.hostname.endsWith('.kingshall.online')) return;
  document.cookie = 'kh_saved_accounts=' + encodeURIComponent(JSON.stringify(accounts.slice(0, 10))) + '; Domain=.kingshall.online; Path=/; Max-Age=31536000; Secure; SameSite=Lax';
}
function saveBrowserAccountHint(user: User) {
  const email = user.email?.trim().toLowerCase();
  if (!email) return;
  clearRemovedAccount(email);
  try {
    const accounts = [email, ...readSavedBrowserAccounts().filter(item => item !== email)].slice(0, 10);
    window.localStorage.setItem('kh_saved_accounts', JSON.stringify(accounts));
    writeBrowserAccountsCookie(accounts);
  } catch {}
  setBrowserAccountHint(email);
}
async function registerDeviceAccount(user: User) {
  saveBrowserAccountHint(user);
  if (!Capacitor.isNativePlatform()) return;
  const deviceUsername = user.username || user.email.split('@')[0] || 'member';
  await DeviceAccount.addAccount({
    email: user.email,
    username: deviceUsername,
    displayName: user.name || user.username || deviceUsername,
    refreshToken: getSessionValue('kh_refresh') || undefined
  });
}
async function api(path: string, body?: unknown): Promise<Result> {
  let response: Response;
  try { response = await fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw new Error('Could not reach ApiKingsHall. Check your connection and try again.'); }
  const data = await response.json().catch(() => ({})) as Result;
  if (!response.ok) { const err = new Error(data.error || 'Request failed.') as Error & { code?: string; email?: string }; err.code = data.code; err.email = data.email; throw err; }
  return data;
}
function getSessionValue(key: 'kh_access' | 'kh_refresh'): string | null {
  // Keep auth credentials across WebView/activity restarts. Migrate credentials
  // from older builds that kept them only in sessionStorage.
  const persistent = window.localStorage.getItem(key);
  if (persistent) return persistent;
  const legacy = window.sessionStorage.getItem(key);
  if (legacy) {
    try { window.localStorage.setItem(key, legacy); } catch {}
    return legacy;
  }
  return null;
}
function store(data: Result) {
  if (data.accessToken) {
    window.localStorage.setItem('kh_access', data.accessToken);
    window.sessionStorage.setItem('kh_access', data.accessToken);
  }
  if (data.refreshToken) {
    window.localStorage.setItem('kh_refresh', data.refreshToken);
    window.sessionStorage.setItem('kh_refresh', data.refreshToken);
  }
}
function clear() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    storage.removeItem('kh_access');
    storage.removeItem('kh_refresh');
  }
}
function go(path: string) {
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function isPersonalIdentityComplete(profile: Record<string, unknown> | null | undefined): boolean {
  if (!profile) return false;
  const requiredText = ['firstName', 'lastName', 'username', 'email', 'phone', 'nationality', 'state', 'postalCode', 'dateOfBirth', 'gender'];
  if (requiredText.some(key => typeof profile[key] !== 'string' || !(profile[key] as string).trim())) return false;
  if (!/^[a-z0-9]{3,24}$/.test(String(profile.username))) return false;
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(profile.email))) return false;
  return ['Female', 'Male', 'Non-binary', 'Other'].includes(String(profile.gender));
}
function sectionFromHash(): HomeSection {
  const value = window.location.hash.slice(1).toUpperCase();
  return (['HOME', 'IDENTITY', 'DEVICE', 'EXTERNAL', 'APPS', 'SECURITY', 'PROFILE', 'HELP', 'ALERTS', 'ABOUT', 'EXIT'] as HomeSection[]).includes(value as HomeSection) ? value as HomeSection : 'HOME';
}
function ArrowIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>; }
function KingsHallMark() { return <img className="kh-brand-mark-svg" src="/kingshall-mark.svg?v=4" alt="" />; }
function FeatureIcon({ type }: { type: 'lock' | 'apps' | 'shield' | 'chat' | 'spark' | 'wallet' }) {
  const paths: Record<string, string> = {
    lock: 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3',
    apps: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
    shield: 'M12 3 19 6v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6z M9 12l2 2 4-4',
    chat: 'M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.5-3A7.5 7.5 0 1 1 20 11.5z',
    spark: 'm12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l1 2.5 2 1-2 1-1 2.5-1-2.5-2-1 2-1z',
    wallet: 'M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12 M16 12h5 M17 12v.1'
  };
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[type]} /></svg>;
}
export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [mode, setMode] = useState<Mode>(() => window.location.pathname === '/signin' ? 'login' : window.location.pathname === '/request-access' ? 'request' : window.location.pathname === '/verify-email' ? 'verify' : window.location.pathname === '/onboard' ? 'onboard' : window.location.pathname === '/access-review' ? 'review' : (window.location.pathname === '/home' || window.location.pathname === '/account') ? 'home' : 'landing');
  const [notice, setNotice] = useState(''); const [success, setSuccess] = useState(false); const [busy, setBusy] = useState(false); const [resendingVerification, setResendingVerification] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState(''); const [user, setUser] = useState<User | null>(null); const [reviewProcessed, setReviewProcessed] = useState(false);
  const [deviceAccountStatus, setDeviceAccountStatus] = useState(Capacitor.isNativePlatform() ? 'Checking Android device account…' : 'Browser session active');
  const [homeSection, setHomeSection] = useState<HomeSection>(() => sectionFromHash());
  const [identitySetupRequired, setIdentitySetupRequired] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [alertsVersion, setAlertsVersion] = useState(0);
  const [headerPulseActive, setHeaderPulseActive] = useState(false);
  const [headerAppearance, setHeaderAppearance] = useState(() => ({
    enabled: localStorage.getItem('kh_alert_color_enabled') !== 'false',
    color: /^#[0-9a-f]{6}$/i.test(localStorage.getItem('kh_alert_color') || '') ? localStorage.getItem('kh_alert_color')! : '#b9c7df'
  }));
  useEffect(() => {
    if (!user?.id || mode !== 'home') {
      if (!user?.id) setIdentitySetupRequired(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await alertsFetch('/api/identity');
        if (!response.ok) throw new Error('Could not verify your personal identity details.');
        const data = await response.json() as { profile?: Record<string, unknown> };
        if (cancelled) return;
        const complete = isPersonalIdentityComplete(data.profile);
        setIdentitySetupRequired(!complete);
        if (!complete) {
          setHomeSection('IDENTITY');
          setPath('/home');
          if (window.location.pathname !== '/home' || window.location.hash !== '#identity') {
            window.history.replaceState({}, '', '/home#identity');
          }
          setNotice('Please complete your Personal identity details to continue using KingsHall.');
          setSuccess(false);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      } catch (error) {
        if (!cancelled) console.warn('KingsHall identity completion check failed:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, mode]);
  useEffect(() => {
    if (!user?.id || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    let cancelled = false;
    void alertsFetch('/api/alerts/preferences').then(async response => {
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({})) as { alertChannels?: { email: boolean; inApp: boolean; push: boolean } };
      if (cancelled || payload.alertChannels?.push !== true) return;
      await registerKingsHallNativePushToken(false);
    }).catch(error => {
      console.warn('KingsHall Android push token refresh failed:', error instanceof Error ? error.message : error);
    });
    return () => { cancelled = true; };
  }, [user?.id]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    let disposed = false;
    let actionListener: { remove: () => Promise<void> } | undefined;
    let receivedListener: { remove: () => Promise<void> } | undefined;
    void PushNotifications.addListener('pushNotificationActionPerformed', () => {
      if (disposed) return;
      if (!getSessionValue('kh_access') && !getSessionValue('kh_refresh')) {
        navigate('login');
        return;
      }
      navigateHomeSection('ALERTS');
    }).then(listener => {
      if (disposed) void listener.remove();
      else actionListener = listener;
    }).catch(error => console.warn('Unable to attach KingsHall push action listener:', error));
    void PushNotifications.addListener('pushNotificationReceived', () => {
      if (!disposed) setAlertsVersion(current => current + 1);
    }).then(listener => {
      if (disposed) void listener.remove();
      else receivedListener = listener;
    }).catch(error => console.warn('Unable to attach KingsHall foreground push listener:', error));
    return () => {
      disposed = true;
      if (actionListener) void actionListener.remove();
      if (receivedListener) void receivedListener.remove();
    };
  }, []);
  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);
  useEffect(() => {
    const syncHeaderAppearance = () => setHeaderAppearance({
      enabled: localStorage.getItem('kh_alert_color_enabled') !== 'false',
      color: /^#[0-9a-f]{6}$/i.test(localStorage.getItem('kh_alert_color') || '') ? localStorage.getItem('kh_alert_color')! : '#b9c7df'
    });
    window.addEventListener('kh:alert-color-changed', syncHeaderAppearance);
    window.addEventListener('storage', syncHeaderAppearance);
    return () => { window.removeEventListener('kh:alert-color-changed', syncHeaderAppearance); window.removeEventListener('storage', syncHeaderAppearance); };
  }, []);
  useEffect(() => {
    if (alertsVersion <= 0) return;
    setHeaderPulseActive(true);
    const timer = window.setTimeout(() => setHeaderPulseActive(false), 10000);
    return () => window.clearTimeout(timer);
  }, [alertsVersion]);
  useEffect(() => {
    const sync = () => { const p = window.location.pathname; setPath(p); setMode(p === '/signin' ? 'login' : p === '/request-access' ? 'request' : p === '/verify-email' ? 'verify' : p === '/onboard' ? 'onboard' : p === '/access-review' ? 'review' : (p === '/home' || p === '/account') ? 'home' : 'landing'); setReviewProcessed(false); setHomeSection(sectionFromHash()); setNotice(''); };
    window.addEventListener('popstate', sync);
    const entryParams = new URLSearchParams(window.location.search);
    const entryReturnTo = entryParams.get('returnTo') || '';
    let validCompanionReturn = false;
    try {
      const candidate = new URL(entryReturnTo);
      validCompanionReturn = candidate.protocol === 'https:' && candidate.pathname === '/signin' && ((entryParams.get('app') === 'crybots' && candidate.hostname === 'crybots.kingshall.online') || (entryParams.get('app') === 'hallschat' && candidate.hostname === 'hallschat.kingshall.online'));
    } catch {}
    // For app sign-in handoffs, let people choose a saved identity instead of
    // silently restoring the previous browser session when multiple accounts exist.
    const showAccountChooser = window.location.pathname === '/signin' && validCompanionReturn && readSavedBrowserAccounts().length > 1;
    const refresh = getSessionValue('kh_refresh');
    if (refresh && !(window.location.pathname === '/signin' && getSessionValue('kh_access')) && !showAccountChooser) api('/api/auth/refresh', { refreshToken: refresh }).then(data => { store(data); if (data.user) { saveBrowserAccountHint(data.user); const params = new URLSearchParams(window.location.search); const returnTo = params.get('returnTo') || ''; let safeReturn: URL | null = null; try { const candidate = new URL(returnTo); if (candidate.protocol === 'https:' && candidate.pathname === '/signin' && ((params.get('app') === 'crybots' && candidate.hostname === 'crybots.kingshall.online') || (params.get('app') === 'hallschat' && candidate.hostname === 'hallschat.kingshall.online'))) safeReturn = candidate; } catch {} if (safeReturn) { safeReturn.hash = 'kingshall_account=' + encodeURIComponent(data.user.email); window.location.assign(safeReturn.toString()); return; } if (window.location.pathname !== '/home' && window.location.pathname !== '/account') { saveBrowserAccountHint(data.user); return; } setUser(data.user); setMode('home'); setPath('/home'); go('/home'); setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'Restoring Android device account…' : 'Browser session active'); registerDeviceAccount(data.user).then(() => { setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'KingsHall is registered in Android device accounts.' : 'You are signed in on this browser.'); }).catch(() => { setDeviceAccountStatus('You are signed in, but Android could not confirm the device account.'); }); } else { clear(); if (window.location.pathname === '/home' || window.location.pathname === '/account') { setMode('landing'); setPath('/'); go('/'); } } }).catch(() => { if (window.location.pathname === '/home' || window.location.pathname === '/account') { setUser(null); setMode('landing'); setPath('/'); go('/'); } });
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    if (window.location.pathname !== '/signin' || user) return;
    const accessToken = getSessionValue('kh_access');
    const refreshToken = getSessionValue('kh_refresh');
    const params = new URLSearchParams(window.location.search);
    const entryReturnTo = params.get('returnTo') || '';
    let validCompanionReturn = false;
    try {
      const candidate = new URL(entryReturnTo);
      validCompanionReturn = candidate.protocol === 'https:' && candidate.pathname === '/signin' && ((params.get('app') === 'crybots' && candidate.hostname === 'crybots.kingshall.online') || (params.get('app') === 'hallschat' && candidate.hostname === 'hallschat.kingshall.online'));
    } catch {}
    if (!accessToken || (validCompanionReturn && readSavedBrowserAccounts().length > 1)) return;
    let cancelled = false;
    void (async () => {
      let validUser: User | null = null;
      try {
        const response = await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + accessToken } });
        if (response.ok) {
          const data = await response.json() as Result;
          validUser = data.user || (data as unknown as User);
        }
      } catch {}
      if (!validUser && refreshToken) {
        try {
          const data = await api('/api/auth/refresh', { refreshToken });
          store(data);
          validUser = data.user || null;
        } catch {}
      }
      if (cancelled) return;
      if (validUser?.id) {
        setUser(validUser);
        setMode('home');
        setPath('/home');
        go('/home');
        setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'Restoring Android device account…' : 'Browser session active');
        void registerDeviceAccount(validUser).then(() => setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'KingsHall is registered in Android device accounts.' : 'You are signed in on this browser.')).catch(() => setDeviceAccountStatus('You are signed in, but Android could not confirm the device account.'));
      } else {
        clear();
        setUser(null);
        setMode('login');
        setPath('/signin');
      }
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!user || mode !== 'home' || !getSessionValue('kh_access')) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let retryTimer: number | null = null;
    let lastEventId = '0';
    const connect = async () => {
      try {
        const initialResponse = await alertsFetch('/api/alerts?limit=1');
        if (initialResponse.ok) {
          const initial = await initialResponse.json() as { alerts?: Array<{ id: string | number }>; unreadCount?: number };
          lastEventId = String(initial.alerts?.[0]?.id || '0');
          if (!stopped && typeof initial.unreadCount === 'number') setUnreadAlerts(initial.unreadCount);
        }
      } catch {}
      while (!stopped) {
        controller = new AbortController();
        try {
          const response = await alertsFetch('/api/alerts/stream', { headers: { Accept: 'text/event-stream', 'Last-Event-ID': lastEventId }, signal: controller.signal });
          if (!response.ok || !response.body) throw new Error('Alerts stream unavailable');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let eventName = 'message';
          let dataLines: string[] = [];
          let frameId: string | null = null;
          const dispatch = () => {
            if (frameId && /^\d+$/.test(frameId)) lastEventId = frameId;
            if (dataLines.length) {
              try {
                const payload = JSON.parse(dataLines.join('\n')) as { unreadCount?: number };
                if (eventName === 'alert') setAlertsVersion(value => value + 1);
                if (eventName === 'unread' && typeof payload.unreadCount === 'number') setUnreadAlerts(payload.unreadCount);
              } catch {}
            }
            eventName = 'message'; dataLines = []; frameId = null;
          };
          while (!stopped) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop() || '';
            for (const frame of frames) {
              for (const line of frame.split(/\r?\n/)) {
                if (line.startsWith('event:')) eventName = line.slice(6).trim();
                else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
                else if (line.startsWith('id:')) frameId = line.slice(3).trim();
              }
              dispatch();
            }
          }
          reader.releaseLock();
        } catch {
          if (stopped) break;
        }
        if (!stopped) await new Promise<void>(resolve => { retryTimer = window.setTimeout(resolve, 3000); });
      }
    };
    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [user?.id, mode]);
  function say(s: string, ok = false) { setNotice(s); setSuccess(ok); }
  function navigate(next: Mode) {
    const route = next === 'login' ? '/signin' : next === 'request' ? '/request-access' : next === 'verify' ? '/verify-email' : next === 'onboard' ? '/onboard' : next === 'review' ? '/access-review' : (next === 'account' || next === 'home') ? '/home' : '/';
    setMode(next); setPath(route); setNotice(''); go(route);
  }
  async function handleSignInClick() {
    let accessToken = getSessionValue('kh_access');
    let refreshToken = getSessionValue('kh_refresh');

    // Android AccountManager is separate from WebView storage. Recover its
    // refresh credential when app data has been cleared and sessionStorage is empty.
    if (!accessToken && !refreshToken && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        const saved = await DeviceAccount.restoreSession();
        if (saved.refreshToken) {
          refreshToken = saved.refreshToken;
          if (saved.email) {
            try { window.localStorage.setItem('kh_saved_accounts', JSON.stringify([saved.email.toLowerCase()])); } catch {}
          }
        }
      } catch {
        // If Android account recovery is unavailable, fall through to normal sign-in.
      }
    }

    if (!accessToken && !refreshToken) { navigate('login'); return; }
    setBusy(true);
    try {
      let validUser: User | null = null;
      if (accessToken) {
        try {
          const response = await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + accessToken } });
          if (response.ok) {
            const data = await response.json() as Result;
            validUser = data.user || (data as unknown as User);
          }
        } catch {
          // A refresh token may still recover the session if access-token validation cannot complete.
        }
      }
      if (!validUser && refreshToken) {
        const data = await api('/api/auth/refresh', { refreshToken });
        store(data);
        validUser = data.user || null;
      }
      if (validUser) {
        setUser(validUser);
        navigate('home');
        setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'Restoring Android device account…' : 'Browser session active');
        registerDeviceAccount(validUser)
          .then(() => setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'KingsHall is registered in Android device accounts.' : 'You are signed in on this browser.'))
          .catch(() => setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'You are signed in, but Android could not confirm the device account.' : 'You are signed in on this browser.'));
        return;
      }
      clear();
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        try { await DeviceAccount.clearSession({}); } catch {}
      }
      setUser(null);
      navigate('login');
    } catch (err) {
      const message = (err as Error)?.message || '';
      if (/refresh session invalid|refresh session invalid or expired|access token expired or invalid|account not found/i.test(message)) {
        clear();
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
          try { await DeviceAccount.clearSession({}); } catch {}
        }
        setUser(null);
      }
      // A network/server failure does not prove that the saved session is invalid.
      // Keep the user on the landing page with credentials intact so they can retry.
      say('KingsHall could not verify your saved session. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || resendingVerification) return; setBusy(true); say('');
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      if (mode === 'request') {
        const data = await api('/api/access/request', { name: f.get('name'), email: f.get('email'), purpose: f.get('purpose') });
        form.reset();
        say(data.message || 'Your access request has been sent for review.', true);
      } else if (mode === 'review') {
        const token = new URLSearchParams(window.location.search).get('token') || '';
        const decision = new URLSearchParams(window.location.search).get('decision') || '';
        const reviewType = new URLSearchParams(window.location.search).get('type') || 'access';
        if (!token || (reviewType === 'verification' ? !['approve', 'reject'].includes(decision) : !['accept', 'reject'].includes(decision))) throw new Error('This review link is invalid.');
        const data = reviewType === 'verification'
          ? await api('/api/identity/verification/review-link', { token, decision })
          : await api('/api/access/review', { token, decision });
        setReviewProcessed(true);
        say(data.message || 'Your decision has been recorded.', true);
      } else if (mode === 'onboard') {
        const token = new URLSearchParams(window.location.search).get('token') || '';
        const password = String(f.get('password') || '');
        const confirmation = String(f.get('confirmPassword') || '');
        if (password !== confirmation) throw new Error('Your passwords do not match.');
        if (!token) throw new Error('This onboarding link is missing or invalid.');
        const data = await api('/api/access/complete', { token, password });
        navigate('login');
        say(data.message || 'Your KingsHall account has been created. You can now sign in.', true);
      } else if (mode === 'verify') {
        const data = await api('/api/auth/verify-email', { email: verifyEmail, code: f.get('code') });
        navigate('login'); say(data.message || 'Email verified. You can sign in.', true);
      } else if (mode === 'login') {
        const identity = String(f.get('identity') || '');
        try {
          const data = await api('/api/auth/login', { identity, password: f.get('password') }); store(data); setUser(data.user || null);
          if (data.user) {
            try { await registerDeviceAccount(data.user); setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'KingsHall is registered in Android device accounts.' : 'You are signed in on this browser.'); }
            catch { setDeviceAccountStatus('You are signed in, but Android could not add the device account.'); }
            const params = new URLSearchParams(window.location.search);
            const returnTo = params.get('returnTo') || '';
            const requestedApp = params.get('app') || '';
            let safeReturn: URL | null = null;
            try {
              const candidate = new URL(returnTo);
              if (candidate.protocol === 'https:' && candidate.pathname === '/signin' && ((requestedApp === 'crybots' && candidate.hostname === 'crybots.kingshall.online') || (requestedApp === 'hallschat' && candidate.hostname === 'hallschat.kingshall.online'))) safeReturn = candidate;
            } catch {}
            if (safeReturn) {
              safeReturn.hash = 'kingshall_account=' + encodeURIComponent(data.user.email);
              window.location.assign(safeReturn.toString());
              return;
            }
            navigate('home'); say(data.message || 'Signed in successfully. Welcome to your KingsHall home.', true);
          } else { navigate('home'); say(data.message || 'Signed in successfully. Welcome to KingsHall.', true); }
        } catch (err) {
          const x = err as Error & { code?: string; email?: string };
          if (x.code === 'EMAIL_NOT_VERIFIED') { setVerifyEmail(x.email || (identity.includes('@') ? identity.trim().toLowerCase() : '')); navigate('verify'); }
          throw err;
        }
      }
    } catch (err) { const x = err as Error & { code?: string; email?: string }; if (x.code === 'EMAIL_DELIVERY_FAILED' && x.email) { setVerifyEmail(x.email); navigate('verify'); } say(x.message || 'Request failed.'); }
    finally { setBusy(false); }
  }
  async function resend() {
    if (busy || resendingVerification || !verifyEmail) return; setResendingVerification(true); say('');
    try { const d = await api('/api/auth/resend-verification', { email: verifyEmail }); say(d.message || 'If eligible, a new code has been sent.', true); }
    catch (e) { say((e as Error).message); } finally { setResendingVerification(false); }
  }
  async function logout(message = 'You have signed out.') {
    const refreshToken = getSessionValue('kh_refresh'); setBusy(true);
    try { if (refreshToken) await api('/api/auth/logout', { refreshToken }); } catch {}
    clear();
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try { await DeviceAccount.clearSession({ email: user?.email }); } catch {}
    }
    setUser(null); setBusy(false); navigate('landing'); say(message, true);
  }

  useEffect(() => {
    if (!user?.id || mode !== 'home') return;
    const settingsKey = 'kh_exit_settings_' + user.id;
    let idleTimer: number | undefined;
    let scheduledTimer: number | undefined;
    let ended = false;

    const readExitSettings = () => {
      try {
        const value = JSON.parse(localStorage.getItem(settingsKey) || '{}') as { idleEnabled?: boolean; idleMinutes?: number; scheduledExitAt?: string };
        return {
          idleEnabled: value.idleEnabled === true,
          idleMinutes: [5, 10, 15, 20, 25, 30].includes(Number(value.idleMinutes)) ? Number(value.idleMinutes) : 10,
          scheduledExitAt: typeof value.scheduledExitAt === 'string' ? value.scheduledExitAt : ''
        };
      } catch { return { idleEnabled: false, idleMinutes: 10, scheduledExitAt: '' }; }
    };

    const triggerExit = async (message: string, clearSchedule = false) => {
      if (ended) return;
      ended = true;
      if (clearSchedule) {
        const current = readExitSettings();
        try {
          localStorage.setItem(settingsKey, JSON.stringify({ ...current, scheduledExitAt: '' }));
          window.dispatchEvent(new CustomEvent('kh:exit-settings-changed', { detail: { userId: user.id } }));
        } catch {}
        let token = getSessionValue('kh_access');
        if (token) {
          try {
            let response = await fetch(API + '/api/auth/scheduled-logout', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
              body: JSON.stringify({ scheduledLogoutAt: null })
            });
            if (!response.ok) {
              const refreshToken = getSessionValue('kh_refresh');
              if (refreshToken) {
                const refreshed = await api('/api/auth/refresh', { refreshToken });
                store(refreshed);
                token = refreshed.accessToken || '';
                if (token) response = await fetch(API + '/api/auth/scheduled-logout', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                  body: JSON.stringify({ scheduledLogoutAt: null })
                });
              }
            }
          } catch {}
        }
      }
      await logout(message);
    };

    const resetIdleTimer = () => {
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      idleTimer = undefined;
      const settings = readExitSettings();
      if (!settings.idleEnabled) return;
      idleTimer = window.setTimeout(() => {
        triggerExit(`You were signed out automatically after ${settings.idleMinutes} minutes of inactivity.`);
      }, settings.idleMinutes * 60 * 1000);
    };

    const checkScheduledExit = () => {
      if (scheduledTimer !== undefined) window.clearTimeout(scheduledTimer);
      scheduledTimer = undefined;
      const scheduledAt = readExitSettings().scheduledExitAt;
      if (!scheduledAt) return;
      const time = new Date(scheduledAt).getTime();
      if (!Number.isFinite(time)) return;
      if (time <= Date.now()) {
        triggerExit('Your scheduled exit time has arrived. You have been signed out.', true);
        return;
      }
      scheduledTimer = window.setTimeout(checkScheduledExit, Math.min(time - Date.now(), 2147483647));
    };

    const syncServerExitSettings = async () => {
      const token = getSessionValue('kh_access');
      if (!token) return;
      try {
        const headers = { Authorization: 'Bearer ' + token };
        const [idleResponse, scheduleResponse] = await Promise.all([
          fetch(API + '/api/auth/idle-logout', { headers }),
          fetch(API + '/api/auth/scheduled-logout', { headers })
        ]);
        if (!idleResponse.ok || !scheduleResponse.ok || ended) return;
        const idle = await idleResponse.json() as { idleLogoutEnabled?: boolean; idleLogoutMinutes?: number };
        const schedule = await scheduleResponse.json() as { scheduledLogoutAt?: string | null };
        const next = {
          ...readExitSettings(),
          idleEnabled: idle.idleLogoutEnabled === true,
          idleMinutes: [5, 10, 15, 20, 25, 30].includes(Number(idle.idleLogoutMinutes)) ? Number(idle.idleLogoutMinutes) : 10,
          scheduledExitAt: typeof schedule.scheduledLogoutAt === 'string' ? schedule.scheduledLogoutAt : ''
        };
        localStorage.setItem(settingsKey, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('kh:exit-settings-changed', { detail: { userId: user.id } }));
      } catch {
        // Local settings remain available if the API is temporarily unreachable.
      }
    };

    const handleActivity = () => resetIdleTimer();
    const handleSettingsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId && detail.userId !== user.id) return;
      resetIdleTimer();
      checkScheduledExit();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== settingsKey) return;
      resetIdleTimer();
      checkScheduledExit();
    };
    const handleResume = () => {
      if (document.visibilityState === 'visible') checkScheduledExit();
    };
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'pointerdown'];
    activityEvents.forEach(eventName => window.addEventListener(eventName, handleActivity, { passive: true }));
    window.addEventListener('kh:exit-settings-changed', handleSettingsChanged as EventListener);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    resetIdleTimer();
    checkScheduledExit();
    void syncServerExitSettings();

    return () => {
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      if (scheduledTimer !== undefined) window.clearTimeout(scheduledTimer);
      activityEvents.forEach(eventName => window.removeEventListener(eventName, handleActivity));
      window.removeEventListener('kh:exit-settings-changed', handleSettingsChanged as EventListener);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [user?.id, mode]);

  const landing = mode === 'landing' || (path !== '/signin' && path !== '/request-access' && path !== '/verify-email' && path !== '/onboard' && path !== '/access-review' && path !== '/account' && path !== '/home');
  function navigateHomeSection(section: HomeSection) {
    if (identitySetupRequired && section !== 'IDENTITY' && section !== 'EXIT') {
      setHomeSection('IDENTITY');
      if (window.location.pathname !== '/home' || window.location.hash !== '#identity') window.history.replaceState({}, '', '/home#identity');
      setPath('/home'); setMode('home');
      setNotice('Please complete your Personal identity details to continue using KingsHall.'); setSuccess(false);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    setHomeSection(section);
    const hash = `#${section.toLowerCase()}`;
    if (window.location.pathname === '/home' && window.location.hash !== hash) {
      window.history.pushState({}, '', `/home${hash}`);
    }
    if (section === 'ALERTS') {
      const target = '/home#alerts';
      if (window.location.pathname !== '/home' || window.location.hash !== '#alerts') {
        window.history.pushState({}, '', target);
      }
      setPath('/home');
      setMode('home');
      setHomeSection('ALERTS');
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    if (section === 'IDENTITY' || section === 'DEVICE' || section === 'EXTERNAL' || section === 'SECURITY' || section === 'ABOUT' || section === 'EXIT') { window.scrollTo({ top: 0, behavior: 'auto' }); return; }
    const targetId = section === 'HOME' ? 'kh-home-top' : section === 'APPS' ? 'kh-home-apps' : section === 'PROFILE' ? 'kh-home-profile' : 'kh-home-help';
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  const showHeaderAlerts = Boolean(user && getSessionValue('kh_access')) && unreadAlerts > 0;
  return <main className="kh-shell">
    <AppUpdateMonitor />
    <header className={`topbar${headerAppearance.enabled && showHeaderAlerts ? ' kh-header-alert-color-active' : ''}`} style={headerAppearance.enabled && showHeaderAlerts ? ({
      borderColor: headerAppearance.color + 'b8',
      boxShadow: headerPulseActive
        ? `0 0 0 1px color-mix(in srgb, ${headerAppearance.color} 72%, transparent), 0 0 18px color-mix(in srgb, ${headerAppearance.color} 48%, transparent), 0 14px 30px rgba(0,0,0,0.24)`
        : `0 0 0 1px color-mix(in srgb, ${headerAppearance.color} 42%, transparent), 0 0 10px color-mix(in srgb, ${headerAppearance.color} 24%, transparent), 0 14px 30px rgba(0,0,0,0.24)`,
      animation: headerPulseActive ? 'kh-header-alert-color-pulse 1.2s ease-in-out infinite' : 'none',
      '--kh-header-alert-color': headerAppearance.color
    } as CSSProperties) : undefined}>
      <span className="header-artwork">
        <span className="header-logo"><KingsHallMark /></span>
      </span>
      <a className="header-brand" href="/home#alerts" onClick={e => { e.preventDefault(); if (getSessionValue('kh_access')) navigateHomeSection('ALERTS'); }}><strong>{!isOnline ? 'NO INTERNET' : showHeaderAlerts ? 'New Alert' : 'KINGSHALL'}</strong>{!isOnline && <small>Check your connection</small>}</a>
      <span className="header-artwork header-artwork-right">
        <span className="header-logo"><KingsHallMark /></span>
        {showHeaderAlerts ? <span className="header-alerts-badge kh-logo-alert-badge" aria-label={`${unreadAlerts} unread alerts`}>{unreadAlerts > 99 ? '99+' : unreadAlerts}</span> : null}
      </span>
    </header>
    {landing ? <>
      <section className="landing-hero" id="top">
        <div className="landing-copy">
          <span className="eyebrow"><span className="eyebrow-line" />THE DIGITAL ECOSYSTEM</span>
          <h1>One identity.<br /><em>Many possibilities.</em></h1>
          <p className="intro-copy">KingsHall is the home base for a connected digital ecosystem — bringing your identity, access, and compatible applications together through one central platform.</p>
          <div className="landing-actions"><button className="primary-button" onClick={() => navigate('request')}>Request Access <ArrowIcon /></button><button className="secondary-button" disabled={busy} onClick={() => void handleSignInClick()}>{busy ? <LoadingDots /> : <>Sign In <ArrowIcon /></>}</button></div>
          <div className="trust-row"><span><FeatureIcon type="shield" /> Security-minded foundation</span><span><FeatureIcon type="apps" /> Connected experiences</span></div>
        </div>
        <div className="ecosystem-panel">
          <div className="ecosystem-panel-top"><span className="panel-kicker">THE KINGSHALL ECOSYSTEM</span><span className="live-indicator"><i /> CENTRAL ACCESS</span></div>
          <div className="ecosystem-core"><span className="core-mark"><KingsHallMark /></span><strong>KingsHall</strong><small>Your digital home base</small></div>
          <div className="ecosystem-links"><div><span className="ecosystem-icon"><FeatureIcon type="wallet" /></span><span><strong>CryBots</strong><small>Digital asset tools and bot experiences</small></span></div><div><span className="ecosystem-icon"><FeatureIcon type="chat" /></span><span><strong>HallsChat</strong><small>Social connection and conversations</small></span></div><div><span className="ecosystem-icon"><FeatureIcon type="spark" /></span><span><strong>Future integrations</strong><small>More compatible services over time</small></span></div></div>
        </div>
      </section>
      <section className="ecosystem-details">
        <div className="section-heading"><span className="eyebrow"><span className="eyebrow-line" />BUILT TO CONNECT</span><h2>A foundation for more than one experience.</h2><p>KingsHall is designed to grow with the services you use, while keeping access and identity at the centre.</p></div>
        <div className="feature-grid">
          <article className="feature-card"><span className="detail-icon"><FeatureIcon type="apps" /></span><h3>Connected applications</h3><p>A central starting point for compatible apps such as CryBots and HallsChat, with room for future ecosystem services.</p></article>
          <article className="feature-card"><span className="detail-icon"><FeatureIcon type="lock" /></span><h3>Identity and access</h3><p>Account sign-in, verified email workflows, and protected sessions form the foundation for connected experiences.</p></article>
          <article className="feature-card"><span className="detail-icon"><FeatureIcon type="shield" /></span><h3>Security-conscious design</h3><p>Security and privacy are core design goals. Available protections depend on the service and its current implementation.</p></article>
          <article className="feature-card"><span className="detail-icon"><FeatureIcon type="spark" /></span><h3>An evolving ecosystem</h3><p>As compatible services are added, KingsHall can become a clearer entry point to more digital activities and tools.</p></article>
        </div>
      </section>
      <section className="final-cta"><span className="eyebrow"><span className="eyebrow-line" />YOUR NEXT STEP</span><h2>Start with KingsHall.</h2><p>Already have an account? Sign in. New to the ecosystem? Request access.</p><div className="landing-actions"><button className="primary-button" onClick={() => navigate('request')}>Request Access <ArrowIcon /></button><button className="secondary-button" disabled={busy} onClick={() => void handleSignInClick()}>{busy ? <LoadingDots /> : <>Sign In <ArrowIcon /></>}</button></div></section>
    </> : mode === 'home' ? <>
      <section className="kh-home kh-home-statistics" id="kh-home-top">
        {homeSection === 'EXIT' ? <ExitPage userId={user?.id} onExit={() => { void logout(); }} onStaySignedIn={() => navigateHomeSection('HOME')} /> : homeSection === 'EXTERNAL' ? <ExternalLoginPage /> : homeSection === 'ALERTS' ? <AlertsPage version={alertsVersion} onUnreadCount={setUnreadAlerts} /> : homeSection === 'ABOUT' ? <AboutPage /> : homeSection === 'DEVICE' ? <SetupPage /> : homeSection === 'IDENTITY' ? <IdentityPage user={user} onPersonalComplete={() => { setIdentitySetupRequired(false); setNotice('Personal identity details completed. You can now continue using KingsHall.'); setSuccess(true); }} /> : homeSection === 'SECURITY' ? <SecurityPage user={user} /> : <StatisticsPage user={user} deviceAccountStatus={deviceAccountStatus} onNavigate={navigateHomeSection} />}
      </section>
      <NowBar section={homeSection} onNavigate={navigateHomeSection} onExit={() => navigateHomeSection('EXIT')} />
    </> : <section className="auth-layout">
      <div className="auth-heading"><button className="back-link" onClick={() => navigate('landing')}>← Back to KingsHall</button><span className="eyebrow"><span className="eyebrow-line" />{mode === 'login' ? 'MEMBER ACCESS' : mode === 'request' ? 'ACCESS APPLICATION' : mode === 'verify' ? 'EMAIL VERIFICATION' : mode === 'review' ? (new URLSearchParams(window.location.search).get('type') === 'verification' ? 'VERIFICATION REVIEW' : 'ACCESS REVIEW') : mode === 'onboard' ? 'ACCOUNT SETUP' : 'YOUR ACCOUNT'}</span>
        <h1>{mode === 'login' ? <>Welcome <em>back.</em></> : mode === 'request' ? <>Request <em>access.</em></> : mode === 'verify' ? <>Verify your <em>email.</em></> : mode === 'review' ? (new URLSearchParams(window.location.search).get('type') === 'verification' ? <>Review <em>verification.</em></> : <>Review <em>access.</em></>) : mode === 'onboard' ? <>Come <em>onboard.</em></> : <>Your <em>KingsHall.</em></>}</h1>
        <p>{mode === 'login' ? 'Sign in to continue to your KingsHall account and connected experiences.' : mode === 'request' ? 'Tell us a little about yourself. Your request will be reviewed by the KingsHall access team before any account is created.' : mode === 'verify' ? `Enter the six-digit code sent to ${verifyEmail || 'your email'}.` : mode === 'review' ? (new URLSearchParams(window.location.search).get('type') === 'verification' ? 'Review this account verification decision before confirming it.' : 'Review this access request decision before confirming it.') : mode === 'onboard' ? 'Create a strong password to activate your approved KingsHall account.' : 'Your KingsHall identity is ready.'}</p>
      </div>
      <section className="auth-card">
        <div className="card-top"><span className="card-symbol"><FeatureIcon type={mode === 'request' ? 'apps' : mode === 'verify' ? 'shield' : 'lock'} /></span><span className="secure"><i />{mode === 'request' ? 'REQUEST FORM' : mode === 'review' ? 'ADMIN REVIEW' : mode === 'onboard' ? 'SECURE SETUP' : mode === 'account' ? 'SIGNED IN' : 'KINGSHALL ACCESS'}</span></div>
        <h2>{mode === 'login' ? 'Sign in' : mode === 'request' ? 'Request access' : mode === 'verify' ? 'Email verification' : mode === 'review' ? (new URLSearchParams(window.location.search).get('type') === 'verification' ? (new URLSearchParams(window.location.search).get('decision') === 'reject' ? 'Decline verification request' : 'Approve verification request') : (new URLSearchParams(window.location.search).get('decision') === 'reject' ? 'Reject access request' : 'Accept access request')) : mode === 'onboard' ? 'Create your password' : `Welcome, ${user?.name?.split(' ')[0] || 'back'}`}</h2>
        <p className="card-subtitle">{mode === 'login' ? 'Use your existing KingsHall credentials.' : mode === 'request' ? 'No account is created when you submit this form.' : mode === 'verify' ? 'Enter the code from your email.' : mode === 'review' ? 'This one-time review link expires after 7 days.' : mode === 'onboard' ? 'Your account is created only after your password is saved.' : 'You are signed in to KingsHall.'}</p>

        {mode === 'login' && <>
          <form onSubmit={submit}><div className="field"><label htmlFor="login-identity">Email or username</label><input id="login-identity" name="identity" autoComplete="username" placeholder="Enter your email or username" required /></div><div className="field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></div><button className="submit-button" type="submit" disabled={busy}>{busy ? <LoadingDots /> : 'Sign In'}{!busy && <ArrowIcon />}</button><p className="form-footnote">New here? <button type="button" onClick={() => navigate('request')}>Request access</button></p></form>
        </>}
        {mode === 'request' && <form onSubmit={submit}><div className="field"><label htmlFor="request-name">Full name</label><input id="request-name" name="name" autoComplete="name" minLength={2} maxLength={80} placeholder="Your full name" required /></div><div className="field"><label htmlFor="request-email">Email address</label><input id="request-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></div><div className="field"><label htmlFor="request-purpose">What interests you about KingsHall? <span className="optional">(optional)</span></label><textarea id="request-purpose" name="purpose" rows={3} maxLength={500} placeholder="Tell us what you hope to explore…" /></div><button className="submit-button" type="submit" disabled={busy}>{busy ? <LoadingDots /> : 'Submit Request'}{!busy && <ArrowIcon />}</button></form>}
        {mode === 'review' && (() => { const params = new URLSearchParams(window.location.search); const decision = params.get('decision'); const verificationReview = params.get('type') === 'verification'; const validDecision = verificationReview ? ['approve', 'reject'].includes(decision || '') : ['accept', 'reject'].includes(decision || ''); const valid = Boolean(params.get('token') && validDecision); return <form onSubmit={submit}><p className="card-subtitle">{verificationReview ? (decision === 'reject' ? 'Confirm that you want to decline this account verification request. The applicant will be notified, and the decision will apply across KingsHall, CryBots and HallsChat.' : 'Confirm that you want to approve this account verification request. The verified badge will be issued centrally by KingsHall and shared with connected apps.') : (decision === 'reject' ? 'Confirm that you want to decline this application. A kind, friendly email will be sent to the applicant.' : 'Confirm that you want to approve this application. The applicant will receive a secure link to create a password; their account will not exist until they complete onboarding.')}</p><button className="submit-button" type="submit" disabled={busy || reviewProcessed || !valid}>{busy ? <LoadingDots /> : reviewProcessed ? 'Decision recorded' : decision === 'reject' ? 'Confirm rejection' : verificationReview ? 'Confirm verification approval' : 'Confirm acceptance'}{!busy && !reviewProcessed && <ArrowIcon />}</button>{!valid && <p className="form-footnote">This review link is invalid or incomplete.</p>}</form>; })()}
        {mode === 'onboard' && <form onSubmit={submit}><div className="field"><label htmlFor="onboard-password">Create password</label><input id="onboard-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder="Create a strong password" required /><p className="form-footnote">Use 12–128 characters with uppercase and lowercase letters, a number, and a symbol.</p></div><div className="field"><label htmlFor="onboard-confirm">Confirm password</label><input id="onboard-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder="Enter the same password again" required /></div><button className="submit-button" type="submit" disabled={busy}>{busy ? <LoadingDots /> : 'Create Account'}{!busy && <ArrowIcon />}</button></form>}
        {mode === 'verify' && <><form onSubmit={submit}><div className="field"><label htmlFor="verify-code">Six-digit code</label><input id="verify-code" name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" placeholder="000000" required /></div><button className="submit-button" type="submit" disabled={busy || resendingVerification}>{busy ? <LoadingDots /> : 'Verify Email'}{!busy && <ArrowIcon />}</button></form><button className="text-button" type="button" disabled={busy || resendingVerification} onClick={resend}>{resendingVerification ? <LoadingDots /> : 'Resend verification code'}</button></>}
        {mode === 'account' && <div className="account-panel"><p><strong>{user?.name}</strong></p><p>@{user?.username}</p><p>{user?.email}</p><button className="submit-button" type="button" disabled={busy} onClick={() => { void logout(); }}>{busy ? <LoadingDots /> : <>Sign Out <ArrowIcon /></>}</button></div>}
        <p className="fine-print">Keep your password and verification codes private. KingsHall will never ask you to share them with another person.</p>
      </section>
    </section>}
    <footer className="footer"><span>© {new Date().getFullYear()} KingsHall</span><span><FeatureIcon type="shield" /> Identity · Access · Ecosystem</span></footer>
    <Toast message={notice} tone={success ? 'success' : 'error'} onClose={() => setNotice('')} />
  </main>;
}
