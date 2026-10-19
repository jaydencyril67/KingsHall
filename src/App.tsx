import { useEffect, useState, type CSSProperties } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import NowBar from './NowBar';
import IdentityPage from './Identity';
import SecurityPage from './Security';
import AlertsPage from './Alerts';
import AboutPage from './About';
import SetupPage from './Setup';
import { alertsFetch } from './alertsClient';
import Toast from './Toast';
import LoadingDots from './components/LoadingDots';
import type { FormEvent } from 'react';
import './App.css';
import AppUpdateMonitor from './AppUpdateMonitor';

type Mode = 'landing' | 'login' | 'request' | 'verify' | 'account' | 'home' | 'onboard' | 'review';
type HomeSection = 'HOME' | 'IDENTITY' | 'DEVICE' | 'APPS' | 'SECURITY' | 'PROFILE' | 'HELP' | 'ALERTS' | 'ABOUT';
type User = { id: string; name: string; username: string; email: string; isEmailVerified: boolean };
type Result = { message?: string; error?: string; code?: string; email?: string; accessToken?: string; refreshToken?: string; user?: User };
const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');
type KingsHallAccountPlugin = { addAccount(options: { email: string; username: string; displayName: string }): Promise<{ accountName: string; alreadyPresent?: boolean }> };
const DeviceAccount = registerPlugin<KingsHallAccountPlugin>('KingsHallAccount');
function readSavedBrowserAccounts(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem('kh_saved_accounts') || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim().toLowerCase()).filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)))].slice(0, 10);
  } catch { return []; }
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
  await DeviceAccount.addAccount({ email: user.email, username: deviceUsername, displayName: user.name || user.username || deviceUsername });
}
async function api(path: string, body?: unknown): Promise<Result> {
  let response: Response;
  try { response = await fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw new Error('Could not reach ApiKingsHall. Check your connection and try again.'); }
  const data = await response.json().catch(() => ({})) as Result;
  if (!response.ok) { const err = new Error(data.error || 'Request failed.') as Error & { code?: string; email?: string }; err.code = data.code; err.email = data.email; throw err; }
  return data;
}
function store(data: Result) { if (data.accessToken) sessionStorage.setItem('kh_access', data.accessToken); if (data.refreshToken) sessionStorage.setItem('kh_refresh', data.refreshToken); }
function clear() { sessionStorage.removeItem('kh_access'); sessionStorage.removeItem('kh_refresh'); }
function go(path: string) {
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function sectionFromHash(): HomeSection {
  const value = window.location.hash.slice(1).toUpperCase();
  return (['HOME', 'IDENTITY', 'DEVICE', 'APPS', 'SECURITY', 'PROFILE', 'HELP', 'ALERTS', 'ABOUT'] as HomeSection[]).includes(value as HomeSection) ? value as HomeSection : 'HOME';
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
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [appAuthRequests, setAppAuthRequests] = useState<Array<{ id: string; appName: string; expiresAt: string }>>([]);
  const [appAuthCode, setAppAuthCode] = useState('');
  const [appAuthBusy, setAppAuthBusy] = useState(false);
  const [appAuthError, setAppAuthError] = useState('');
  const [alertsVersion, setAlertsVersion] = useState(0);
  const [headerPulseActive, setHeaderPulseActive] = useState(false);
  const [headerAppearance, setHeaderAppearance] = useState(() => ({
    enabled: localStorage.getItem('kh_alert_color_enabled') !== 'false',
    color: /^#[0-9a-f]{6}$/i.test(localStorage.getItem('kh_alert_color') || '') ? localStorage.getItem('kh_alert_color')! : '#b9c7df'
  }));
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
    if (!user?.id) { setAppAuthRequests([]); return; }
    let stopped = false;
    const poll = async () => {
      const token = sessionStorage.getItem('kh_access');
      if (!token) return;
      try {
        const response = await fetch(API + '/api/app-auth/pending', { headers: { Authorization: 'Bearer ' + token } });
        if (!response.ok) return;
        const data = await response.json() as { requests?: Array<{ id: string; appName: string; expiresAt: string }> };
        if (!stopped) {
          setAppAuthRequests(data.requests || []);
        }
      } catch {}
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 2500);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [user?.id]);
  useEffect(() => { setAppAuthCode(''); setAppAuthError(''); }, [appAuthRequests[0]?.id]);
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
    const refresh = sessionStorage.getItem('kh_refresh');
    if (refresh && !showAccountChooser) api('/api/auth/refresh', { refreshToken: refresh }).then(data => { store(data); setUser(data.user || null); if (data.user) { saveBrowserAccountHint(data.user); const params = new URLSearchParams(window.location.search); const returnTo = params.get('returnTo') || ''; let safeReturn: URL | null = null; try { const candidate = new URL(returnTo); if (candidate.protocol === 'https:' && candidate.pathname === '/signin' && ((params.get('app') === 'crybots' && candidate.hostname === 'crybots.kingshall.online') || (params.get('app') === 'hallschat' && candidate.hostname === 'hallschat.kingshall.online'))) safeReturn = candidate; } catch {} if (safeReturn) { safeReturn.hash = 'kingshall_account=' + encodeURIComponent(data.user.email); window.location.assign(safeReturn.toString()); return; } setMode('home'); setPath('/home'); go('/home'); setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'Restoring Android device account…' : 'Browser session active'); registerDeviceAccount(data.user).then(() => { setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'KingsHall is registered in Android device accounts.' : 'You are signed in on this browser.'); }).catch(() => { setDeviceAccountStatus('You are signed in, but Android could not confirm the device account.'); }); } else { clear(); if (window.location.pathname === '/home' || window.location.pathname === '/account') { setMode('landing'); setPath('/'); go('/'); } } }).catch(() => { clear(); if (window.location.pathname === '/home' || window.location.pathname === '/account') { setUser(null); setMode('landing'); setPath('/'); go('/'); } });
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    if (!user || mode !== 'home' || !sessionStorage.getItem('kh_access')) return;
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
    const accessToken = sessionStorage.getItem('kh_access');
    const refreshToken = sessionStorage.getItem('kh_refresh');
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
      setUser(null);
      navigate('login');
    } catch (err) {
      const message = (err as Error)?.message || '';
      if (/refresh session invalid|refresh session invalid or expired|access token expired or invalid|account not found/i.test(message)) {
        clear();
        setUser(null);
      }
      // Keep stored credentials intact on network/server errors; the user can still reach Sign In.
      navigate('login');
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
        if (!token || !['accept', 'reject'].includes(decision)) throw new Error('This access review link is invalid.');
        const data = await api('/api/access/review', { token, decision });
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
  async function logout() {
    const refreshToken = sessionStorage.getItem('kh_refresh'); setBusy(true);
    try { await api('/api/auth/logout', { refreshToken }); } catch {}
    clear(); setUser(null); setBusy(false); navigate('landing'); say('You have signed out.', true);
  }
  async function respondToAppAuth(action: 'approve' | 'deny', requestId: string) {
    const token = sessionStorage.getItem('kh_access');
    if (!token || appAuthBusy) return;
    setAppAuthBusy(true);
    setAppAuthError('');
    try {
      const response = await fetch(API + '/api/app-auth/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(action === 'approve' ? { requestId, code: appAuthCode } : { requestId })
      });
      const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to process this sign-in request.');
      setAppAuthRequests(current => current.filter(request => request.id !== requestId));
      setAppAuthCode('');
      setAppAuthError('');
      say(data.message || (action === 'approve' ? 'Sign-in approved.' : 'Sign-in request denied.'), action === 'approve');
    } catch (error) {
      setAppAuthError((error as Error).message || 'Unable to process this sign-in request.');
    } finally {
      setAppAuthBusy(false);
    }
  }
  const landing = mode === 'landing' || (path !== '/signin' && path !== '/request-access' && path !== '/verify-email' && path !== '/onboard' && path !== '/access-review' && path !== '/account' && path !== '/home');
  function navigateHomeSection(section: HomeSection) {
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
    if (section === 'IDENTITY' || section === 'DEVICE' || section === 'SECURITY' || section === 'ABOUT') { window.scrollTo({ top: 0, behavior: 'auto' }); return; }
    const targetId = section === 'HOME' ? 'kh-home-top' : section === 'APPS' ? 'kh-home-apps' : section === 'PROFILE' ? 'kh-home-profile' : 'kh-home-help';
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  return <main className="kh-shell">
    <AppUpdateMonitor />
    <header className={`topbar${headerAppearance.enabled && unreadAlerts > 0 ? ' kh-header-alert-color-active' : ''}`} style={headerAppearance.enabled && unreadAlerts > 0 ? ({
      borderColor: headerAppearance.color + 'b8',
      boxShadow: headerPulseActive
        ? `0 0 0 1px color-mix(in srgb, ${headerAppearance.color} 72%, transparent), 0 0 18px color-mix(in srgb, ${headerAppearance.color} 48%, transparent), 0 14px 30px rgba(0,0,0,0.24)`
        : `0 0 0 1px color-mix(in srgb, ${headerAppearance.color} 42%, transparent), 0 0 10px color-mix(in srgb, ${headerAppearance.color} 24%, transparent), 0 14px 30px rgba(0,0,0,0.24)`,
      animation: headerPulseActive ? 'kh-header-alert-color-pulse 1.2s ease-in-out infinite' : 'none',
      '--kh-header-alert-color': headerAppearance.color
    } as CSSProperties) : undefined}>
      <span className="header-artwork">
        <span className="header-logo"><KingsHallMark /></span>
        {unreadAlerts > 0 ? <span className="header-alerts-badge kh-logo-alert-badge" aria-label={`${unreadAlerts} unread alerts`}>{unreadAlerts > 99 ? '99+' : unreadAlerts}</span> : null}
      </span>
      <a className="header-brand" href="/home#alerts" onClick={e => { e.preventDefault(); if (sessionStorage.getItem('kh_access')) navigateHomeSection('ALERTS'); }}><strong>{!isOnline ? 'NO INTERNET' : unreadAlerts > 0 ? 'New Alert' : 'KINGSHALL'}</strong>{!isOnline && <small>Check your connection</small>}</a>
      <span className="header-artwork header-artwork-right">
        <span className="header-logo"><KingsHallMark /></span>
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
      <section className="kh-home" id="kh-home-top">
        {homeSection === 'ALERTS' ? <AlertsPage version={alertsVersion} onUnreadCount={setUnreadAlerts} /> : homeSection === 'ABOUT' ? <AboutPage /> : homeSection === 'DEVICE' ? <SetupPage /> : homeSection === 'IDENTITY' ? <IdentityPage user={user} /> : homeSection === 'SECURITY' ? <SecurityPage user={user} /> : <>
        <div className="kh-home-heading">
          <span className="eyebrow"><span className="eyebrow-line" />KINGSHALL HOME</span>
          <p className="kh-home-greeting">WELCOME BACK</p>
          <h1>Your digital <em>home base.</em></h1>
          <p className="kh-home-intro">Your KingsHall identity, device account, and ecosystem entry points — together in one place.</p>
        </div>

        <section className="kh-home-overview" aria-label="Account overview">
          <article className="kh-home-card kh-home-identity" id="kh-home-identity">
            <div className="kh-home-card-top"><span className="kh-home-card-icon"><FeatureIcon type="shield" /></span><span className="kh-home-tag">IDENTITY ACTIVE</span></div>
            <span className="kh-home-kicker">YOUR KINGSHALL ID</span>
            <h2>{user?.name || 'KingsHall member'}</h2>
            <p className="kh-home-muted">@{user?.username || 'member'}</p>
            <div className="kh-home-detail"><span>Email</span><strong>{user?.email || 'Signed-in account'}</strong></div>
            <div className="kh-home-detail"><span>Verification</span><strong>{user?.isEmailVerified ? 'Email verified' : 'Account session active'}</strong></div>
            <div className="kh-home-detail"><span>Device account</span><strong>{deviceAccountStatus}</strong></div>
          </article>
          <article className="kh-home-card kh-home-welcome" id="kh-home-security">
            <div className="kh-home-card-top"><span className="kh-home-card-icon"><FeatureIcon type="lock" /></span><span className="kh-home-tag">SESSION</span></div>
            <h2>Your session is active.</h2>
            <p className="kh-home-muted">Keep your password and verification codes private. Sign out when you're using a shared device.</p>
            <button className="secondary-button kh-home-signout" type="button" disabled={busy} onClick={logout}>{busy ? <LoadingDots /> : <>Sign Out <ArrowIcon /></>}</button>
          </article>
        </section>
        <section className="kh-home-section" id="kh-home-apps">
          <div className="kh-home-section-heading"><span className="eyebrow"><span className="eyebrow-line" />THE ECOSYSTEM</span><h2>Your connected possibilities.</h2><p>Explore KingsHall ecosystem applications from your home base.</p></div>
          <div className="kh-home-app-grid">
            <article className="kh-home-app-card"><span className="kh-home-card-icon"><FeatureIcon type="wallet" /></span><h3>CryBots</h3><p>Digital asset tools and bot experiences.</p><a href="https://crybots.kingshall.online" target="_blank" rel="noreferrer">Open CryBots <ArrowIcon /></a></article>
            <article className="kh-home-app-card"><span className="kh-home-card-icon"><FeatureIcon type="chat" /></span><h3>HallsChat</h3><p>Social connections and conversations.</p><a href="https://hallschat.kingshall.online" target="_blank" rel="noreferrer">Open HallsChat <ArrowIcon /></a></article>
            <article className="kh-home-app-card kh-home-app-coming"><span className="kh-home-card-icon"><FeatureIcon type="spark" /></span><h3>More to come</h3><p>A home for future compatible KingsHall services.</p><span className="kh-home-coming-label">ECOSYSTEM EXPANDING</span></article>
          </div>
        </section>
        <section className="kh-home-lower-grid">
          <article className="kh-home-card" id="kh-home-profile"><div className="kh-home-card-top"><span className="kh-home-card-icon"><FeatureIcon type="apps" /></span><span className="kh-home-tag">PROFILE</span></div><h2>Your account details</h2><p className="kh-home-muted">This is the identity currently signed in to KingsHall.</p><div className="kh-home-detail"><span>Full name</span><strong>{user?.name || 'Not available'}</strong></div><div className="kh-home-detail"><span>Username</span><strong>@{user?.username || 'member'}</strong></div><div className="kh-home-detail"><span>Email</span><strong>{user?.email || 'Not available'}</strong></div></article>
          <article className="kh-home-card" id="kh-home-help"><div className="kh-home-card-top"><span className="kh-home-card-icon"><FeatureIcon type="chat" /></span><span className="kh-home-tag">HELP & SAFETY</span></div><h2>Keep your account secure.</h2><p className="kh-home-muted">Never share your password or one-time verification codes. If you use a shared device, sign out before leaving.</p><button className="secondary-button kh-home-help-button" type="button" onClick={() => navigateHomeSection('IDENTITY')}>Review my identity <ArrowIcon /></button></article>
        </section>
        </>}
      </section>
      <NowBar section={homeSection} onNavigate={navigateHomeSection} onExit={logout} />
    </> : <section className="auth-layout">
      <div className="auth-heading"><button className="back-link" onClick={() => navigate('landing')}>← Back to KingsHall</button><span className="eyebrow"><span className="eyebrow-line" />{mode === 'login' ? 'MEMBER ACCESS' : mode === 'request' ? 'ACCESS APPLICATION' : mode === 'verify' ? 'EMAIL VERIFICATION' : mode === 'review' ? 'ACCESS REVIEW' : mode === 'onboard' ? 'ACCOUNT SETUP' : 'YOUR ACCOUNT'}</span>
        <h1>{mode === 'login' ? <>Welcome <em>back.</em></> : mode === 'request' ? <>Request <em>access.</em></> : mode === 'verify' ? <>Verify your <em>email.</em></> : mode === 'review' ? <>Review <em>access.</em></> : mode === 'onboard' ? <>Come <em>onboard.</em></> : <>Your <em>KingsHall.</em></>}</h1>
        <p>{mode === 'login' ? 'Sign in to continue to your KingsHall account and connected experiences.' : mode === 'request' ? 'Tell us a little about yourself. Your request will be reviewed by the KingsHall access team before any account is created.' : mode === 'verify' ? `Enter the six-digit code sent to ${verifyEmail || 'your email'}.` : mode === 'review' ? 'Review this access request decision before confirming it.' : mode === 'onboard' ? 'Create a strong password to activate your approved KingsHall account.' : 'Your KingsHall identity is ready.'}</p>
      </div>
      <section className="auth-card">
        <div className="card-top"><span className="card-symbol"><FeatureIcon type={mode === 'request' ? 'apps' : mode === 'verify' ? 'shield' : 'lock'} /></span><span className="secure"><i />{mode === 'request' ? 'REQUEST FORM' : mode === 'review' ? 'ADMIN REVIEW' : mode === 'onboard' ? 'SECURE SETUP' : mode === 'account' ? 'SIGNED IN' : 'KINGSHALL ACCESS'}</span></div>
        <h2>{mode === 'login' ? 'Sign in' : mode === 'request' ? 'Request access' : mode === 'verify' ? 'Email verification' : mode === 'review' ? (new URLSearchParams(window.location.search).get('decision') === 'reject' ? 'Reject access request' : 'Accept access request') : mode === 'onboard' ? 'Create your password' : `Welcome, ${user?.name?.split(' ')[0] || 'back'}`}</h2>
        <p className="card-subtitle">{mode === 'login' ? 'Use your existing KingsHall credentials.' : mode === 'request' ? 'No account is created when you submit this form.' : mode === 'verify' ? 'Enter the code from your email.' : mode === 'review' ? 'This one-time review link expires after 7 days.' : mode === 'onboard' ? 'Your account is created only after your password is saved.' : 'You are signed in to KingsHall.'}</p>

        {mode === 'login' && <>
          <form onSubmit={submit}><div className="field"><label htmlFor="login-identity">Email or username</label><input id="login-identity" name="identity" autoComplete="username" placeholder="Enter your email or username" required /></div><div className="field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></div><button className="submit-button" type="submit" disabled={busy}>{busy ? <LoadingDots /> : 'Sign In'}{!busy && <ArrowIcon />}</button><p className="form-footnote">New here? <button type="button" onClick={() => navigate('request')}>Request access</button></p></form>
        </>}
        {mode === 'request' && <form onSubmit={submit}><div className="field"><label htmlFor="request-name">Full name</label><input id="request-name" name="name" autoComplete="name" minLength={2} maxLength={80} placeholder="Your full name" required /></div><div className="field"><label htmlFor="request-email">Email address</label><input id="request-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></div><div className="field"><label htmlFor="request-purpose">What interests you about KingsHall? <span className="optional">(optional)</span></label><textarea id="request-purpose" name="purpose" rows={3} maxLength={500} placeholder="Tell us what you hope to explore…" /></div><button className="submit-button" type="submit" disabled={busy}>{busy ? <LoadingDots /> : 'Submit Request'}{!busy && <ArrowIcon />}</button></form>}
        {mode === 'review' && (() => { const decision = new URLSearchParams(window.location.search).get('decision'); const valid = Boolean(new URLSearchParams(window.location.search).get('token') && ['accept', 'reject'].includes(decision || '')); return <form onSubmit={submit}><p className="card-subtitle">{decision === 'reject' ? 'Confirm that you want to decline this application. A kind, friendly email will be sent to the applicant.' : 'Confirm that you want to approve this application. The applicant will receive a secure link to create a password; their account will not exist until they complete onboarding.'}</p><button className="submit-button" type="submit" disabled={busy || reviewProcessed || !valid}>{busy ? <LoadingDots /> : reviewProcessed ? 'Decision recorded' : decision === 'reject' ? 'Confirm rejection' : 'Confirm acceptance'}{!busy && !reviewProcessed && <ArrowIcon />}</button>{!valid && <p className="form-footnote">This review link is invalid or incomplete.</p>}</form>; })()}
        {mode === 'onboard' && <form onSubmit={submit}><div className="field"><label htmlFor="onboard-password">Create password</label><input id="onboard-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder="Create a strong password" required /><p className="form-footnote">Use 12–128 characters with uppercase and lowercase letters, a number, and a symbol.</p></div><div className="field"><label htmlFor="onboard-confirm">Confirm password</label><input id="onboard-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder="Enter the same password again" required /></div><button className="submit-button" type="submit" disabled={busy}>{busy ? <LoadingDots /> : 'Create Account'}{!busy && <ArrowIcon />}</button></form>}
        {mode === 'verify' && <><form onSubmit={submit}><div className="field"><label htmlFor="verify-code">Six-digit code</label><input id="verify-code" name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" placeholder="000000" required /></div><button className="submit-button" type="submit" disabled={busy || resendingVerification}>{busy ? <LoadingDots /> : 'Verify Email'}{!busy && <ArrowIcon />}</button></form><button className="text-button" type="button" disabled={busy || resendingVerification} onClick={resend}>{resendingVerification ? <LoadingDots /> : 'Resend verification code'}</button></>}
        {mode === 'account' && <div className="account-panel"><p><strong>{user?.name}</strong></p><p>@{user?.username}</p><p>{user?.email}</p><button className="submit-button" type="button" disabled={busy} onClick={logout}>{busy ? <LoadingDots /> : <>Sign Out <ArrowIcon /></>}</button></div>}
        <p className="fine-print">Keep your password and verification codes private. KingsHall will never ask you to share them with another person.</p>
      </section>
    </section>}
    <footer className="footer"><span>© {new Date().getFullYear()} KingsHall</span><span><FeatureIcon type="shield" /> Identity · Access · Ecosystem</span></footer>
    {appAuthRequests.length > 0 && user && <div role="dialog" aria-modal="true" aria-labelledby="app-auth-title" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(3,3,4,.80)', backdropFilter: 'blur(14px)' }}>
      <section style={{ width: 'min(100%, 460px)', boxSizing: 'border-box', border: '1px solid var(--kh-card-primary-border)', borderRadius: 24, padding: 'clamp(20px,5vw,30px)', background: 'var(--kh-card-primary-surface)', color: '#f3f4f6', boxShadow: 'var(--kh-card-inset-highlight), 0 24px 90px rgba(0,0,0,.45)', backdropFilter: 'blur(22px) saturate(125%)' }}>
        <div className="card-top"><span className="card-symbol"><FeatureIcon type="shield" /></span><span className="secure"><i /> SIGN-IN APPROVAL</span></div>
        <h2 id="app-auth-title" style={{ marginTop: 18 }}>Approve CryBots sign-in</h2>
        <p className="card-subtitle">Someone is requesting access to your KingsHall identity through {appAuthRequests[0].appName}. Only approve this if you started the sign-in yourself.</p>
        <form onSubmit={(event) => { event.preventDefault(); void respondToAppAuth('approve', appAuthRequests[0].id); }}>
          <div className="field">
            <label htmlFor="app-auth-code">Two-digit code shown in CryBots</label>
            <input id="app-auth-code" name="appAuthCode" value={appAuthCode} onChange={event => { setAppAuthCode(event.target.value.replace(/\D/g, '').slice(0, 2)); setAppAuthError(''); }} inputMode="numeric" pattern="[0-9]{2}" maxLength={2} autoComplete="off" placeholder="00" required autoFocus />
          </div>
          {appAuthError && <p role="alert" style={{ color: '#e8bcbc', fontSize: 13 }}>{appAuthError}</p>}
          <button className="submit-button" type="submit" disabled={appAuthBusy || appAuthCode.length !== 2}>{appAuthBusy ? <LoadingDots /> : 'Approve sign-in'}{!appAuthBusy && <ArrowIcon />}</button>
        </form>
        <button className="text-button" type="button" disabled={appAuthBusy} onClick={() => void respondToAppAuth('deny', appAuthRequests[0].id)}>Deny request</button>
        <p className="fine-print">This approval expires automatically. Never approve a request you did not initiate.</p>
      </section>
    </div>}
    <Toast message={notice} tone={success ? 'success' : 'error'} onClose={() => setNotice('')} />
  </main>;
}
