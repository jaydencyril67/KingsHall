import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import NowBar from './NowBar';
import IdentityPage from './Identity';
import SecurityPage from './Security';
import Toast from './Toast';
import LoadingDots from './components/LoadingDots';
import type { FormEvent } from 'react';
import './App.css';

type Mode = 'landing' | 'login' | 'request' | 'verify' | 'account' | 'home' | 'onboard' | 'review';
type HomeSection = 'HOME' | 'IDENTITY' | 'APPS' | 'SECURITY' | 'PROFILE' | 'HELP';
type User = { id: string; name: string; username: string; email: string; isEmailVerified: boolean };
type Result = { message?: string; error?: string; code?: string; email?: string; accessToken?: string; refreshToken?: string; user?: User };
const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');
type KingsHallAccountPlugin = { addAccount(options: { email: string; username: string; displayName: string }): Promise<{ accountName: string; alreadyPresent?: boolean }> };
const DeviceAccount = registerPlugin<KingsHallAccountPlugin>('KingsHallAccount');
async function registerDeviceAccount(user: User) {
  if (!Capacitor.isNativePlatform()) return;
  await DeviceAccount.addAccount({ email: user.email, username: user.username, displayName: user.name || user.username });
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
  return (['HOME', 'IDENTITY', 'APPS', 'SECURITY', 'PROFILE', 'HELP'] as HomeSection[]).includes(value as HomeSection) ? value as HomeSection : 'HOME';
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
  const [notice, setNotice] = useState(''); const [success, setSuccess] = useState(false); const [busy, setBusy] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState(''); const [user, setUser] = useState<User | null>(null); const [reviewProcessed, setReviewProcessed] = useState(false);
  const [deviceAccountStatus, setDeviceAccountStatus] = useState(Capacitor.isNativePlatform() ? 'Checking Android device account…' : 'Browser session active');
  const [homeSection, setHomeSection] = useState<HomeSection>(() => sectionFromHash());
  useEffect(() => {
    const sync = () => { const p = window.location.pathname; setPath(p); setMode(p === '/signin' ? 'login' : p === '/request-access' ? 'request' : p === '/verify-email' ? 'verify' : p === '/onboard' ? 'onboard' : p === '/access-review' ? 'review' : (p === '/home' || p === '/account') ? 'home' : 'landing'); setReviewProcessed(false); setHomeSection(sectionFromHash()); setNotice(''); };
    window.addEventListener('popstate', sync);
    const refresh = sessionStorage.getItem('kh_refresh');
    if (refresh) api('/api/auth/refresh', { refreshToken: refresh }).then(data => { store(data); setUser(data.user || null); if (data.user) { setMode('home'); setPath('/home'); go('/home'); setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'Restoring Android device account…' : 'Browser session active'); registerDeviceAccount(data.user).then(() => setDeviceAccountStatus(Capacitor.isNativePlatform() ? 'KingsHall is registered in Android device accounts.' : 'You are signed in on this browser.')).catch(() => setDeviceAccountStatus('You are signed in, but Android could not confirm the device account.')); } else { clear(); if (window.location.pathname === '/home' || window.location.pathname === '/account') { setMode('landing'); setPath('/'); go('/'); } } }).catch(() => { clear(); if (window.location.pathname === '/home' || window.location.pathname === '/account') { setUser(null); setMode('landing'); setPath('/'); go('/'); } });
    return () => window.removeEventListener('popstate', sync);
  }, []);
  function say(s: string, ok = false) { setNotice(s); setSuccess(ok); }
  function navigate(next: Mode) {
    const route = next === 'login' ? '/signin' : next === 'request' ? '/request-access' : next === 'verify' ? '/verify-email' : next === 'onboard' ? '/onboard' : next === 'review' ? '/access-review' : (next === 'account' || next === 'home') ? '/home' : '/';
    setMode(next); setPath(route); setNotice(''); go(route);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; setBusy(true); say('');
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
    if (busy || !verifyEmail) return; setBusy(true); say('');
    try { const d = await api('/api/auth/resend-verification', { email: verifyEmail }); say(d.message || 'If eligible, a new code has been sent.', true); }
    catch (e) { say((e as Error).message); } finally { setBusy(false); }
  }
  async function logout() {
    const refreshToken = sessionStorage.getItem('kh_refresh'); setBusy(true);
    try { await api('/api/auth/logout', { refreshToken }); } catch {}
    clear(); setUser(null); setBusy(false); navigate('landing'); say('You have signed out.', true);
  }
  const landing = mode === 'landing' || (path !== '/signin' && path !== '/request-access' && path !== '/verify-email' && path !== '/onboard' && path !== '/access-review' && path !== '/account' && path !== '/home');
  function navigateHomeSection(section: HomeSection) {
    setHomeSection(section);
    const hash = `#${section.toLowerCase()}`;
    if (window.location.pathname === '/home' && window.location.hash !== hash) {
      window.history.pushState({}, '', `/home${hash}`);
    }
    if (section === 'IDENTITY' || section === 'SECURITY') { window.scrollTo({ top: 0, behavior: 'auto' }); return; }
    const targetId = section === 'HOME' ? 'kh-home-top' : section === 'APPS' ? 'kh-home-apps' : section === 'PROFILE' ? 'kh-home-profile' : 'kh-home-help';
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  return <main className="kh-shell">
    <header className="topbar">
      <span className="header-artwork"><span className="header-logo"><KingsHallMark /></span></span>
      <a className="header-brand" href="/" onClick={e => { e.preventDefault(); navigate('landing'); }}><strong>KINGSHALL</strong><small>One identity · Connected possibilities</small></a>
      <span className="header-artwork header-artwork-right"><span className="header-status-dot" /></span>
    </header>
    {landing ? <>
      <section className="landing-hero" id="top">
        <div className="landing-copy">
          <span className="eyebrow"><span className="eyebrow-line" />THE DIGITAL ECOSYSTEM</span>
          <h1>One identity.<br /><em>Many possibilities.</em></h1>
          <p className="intro-copy">KingsHall is the home base for a connected digital ecosystem — bringing your identity, access, and compatible applications together through one central platform.</p>
          <div className="landing-actions"><button className="primary-button" onClick={() => navigate('request')}>Request Access <ArrowIcon /></button><button className="secondary-button" onClick={() => navigate('login')}>Sign In <ArrowIcon /></button></div>
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
      <section className="final-cta"><span className="eyebrow"><span className="eyebrow-line" />YOUR NEXT STEP</span><h2>Start with KingsHall.</h2><p>Already have an account? Sign in. New to the ecosystem? Request access.</p><div className="landing-actions"><button className="primary-button" onClick={() => navigate('request')}>Request Access <ArrowIcon /></button><button className="secondary-button" onClick={() => navigate('login')}>Sign In <ArrowIcon /></button></div></section>
    </> : mode === 'home' ? <>
      <section className="kh-home" id="kh-home-top">
        {homeSection === 'IDENTITY' ? <IdentityPage user={user} /> : homeSection === 'SECURITY' ? <SecurityPage user={user} /> : <>
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

        {mode === 'login' && <form onSubmit={submit}><div className="field"><label htmlFor="login-identity">Email or username</label><input id="login-identity" name="identity" autoComplete="username" placeholder="Enter your email or username" required /></div><div className="field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></div><button className="submit-button" type="submit" disabled={busy}>{busy ? <LoadingDots /> : 'Sign In'}{!busy && <ArrowIcon />}</button><p className="form-footnote">New here? <button type="button" onClick={() => navigate('request')}>Request access</button></p></form>}
        {mode === 'request' && <form onSubmit={submit}><div className="field"><label htmlFor="request-name">Full name</label><input id="request-name" name="name" autoComplete="name" minLength={2} maxLength={80} placeholder="Your full name" required /></div><div className="field"><label htmlFor="request-email">Email address</label><input id="request-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></div><div className="field"><label htmlFor="request-purpose">What interests you about KingsHall? <span className="optional">(optional)</span></label><textarea id="request-purpose" name="purpose" rows={3} maxLength={500} placeholder="Tell us what you hope to explore…" /></div><button className="submit-button" type="submit" disabled={busy}>{busy ? <LoadingDots /> : 'Submit Request'}{!busy && <ArrowIcon />}</button></form>}
        {mode === 'review' && (() => { const decision = new URLSearchParams(window.location.search).get('decision'); const valid = Boolean(new URLSearchParams(window.location.search).get('token') && ['accept', 'reject'].includes(decision || '')); return <form onSubmit={submit}><p className="card-subtitle">{decision === 'reject' ? 'Confirm that you want to decline this application. A kind, friendly email will be sent to the applicant.' : 'Confirm that you want to approve this application. The applicant will receive a secure link to create a password; their account will not exist until they complete onboarding.'}</p><button className="submit-button" type="submit" disabled={busy || reviewProcessed || !valid}>{busy ? <LoadingDots /> : reviewProcessed ? 'Decision recorded' : decision === 'reject' ? 'Confirm rejection' : 'Confirm acceptance'}{!busy && !reviewProcessed && <ArrowIcon />}</button>{!valid && <p className="form-footnote">This review link is invalid or incomplete.</p>}</form>; })()}
        {mode === 'onboard' && <form onSubmit={submit}><div className="field"><label htmlFor="onboard-password">Create password</label><input id="onboard-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder="Create a strong password" required /><p className="form-footnote">Use 12–128 characters with uppercase and lowercase letters, a number, and a symbol.</p></div><div className="field"><label htmlFor="onboard-confirm">Confirm password</label><input id="onboard-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder="Enter the same password again" required /></div><button className="submit-button" type="submit" disabled={busy}>{busy ? <LoadingDots /> : 'Create Account'}{!busy && <ArrowIcon />}</button></form>}
        {mode === 'verify' && <><form onSubmit={submit}><div className="field"><label htmlFor="verify-code">Six-digit code</label><input id="verify-code" name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" placeholder="000000" required /></div><button className="submit-button" type="submit" disabled={busy}>{busy ? <LoadingDots /> : 'Verify Email'}{!busy && <ArrowIcon />}</button></form><button className="text-button" type="button" disabled={busy} onClick={resend}>{busy ? <LoadingDots /> : 'Resend verification code'}</button></>}
        {mode === 'account' && <div className="account-panel"><p><strong>{user?.name}</strong></p><p>@{user?.username}</p><p>{user?.email}</p><button className="submit-button" type="button" disabled={busy} onClick={logout}>{busy ? <LoadingDots /> : <>Sign Out <ArrowIcon /></>}</button></div>}
        <p className="fine-print">Keep your password and verification codes private. KingsHall will never ask you to share them with another person.</p>
      </section>
    </section>}
    <footer className="footer"><span>© {new Date().getFullYear()} KingsHall</span><span><FeatureIcon type="shield" /> Identity · Access · Ecosystem</span></footer>
    <Toast message={notice} tone={success ? 'success' : 'error'} onClose={() => setNotice('')} />
  </main>;
}
