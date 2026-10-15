import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { FormEvent } from 'react';
import './App.css';

type Mode = 'login' | 'signup' | 'verify' | 'account';
type User = { id: string; name: string; username: string; email: string; isEmailVerified: boolean };
type Result = { message?: string; error?: string; code?: string; email?: string; accessToken?: string; refreshToken?: string; user?: User };
const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');

type KingsHallAccountPlugin = {
  addAccount(options: { email: string; username: string; displayName: string }): Promise<{ accountName: string; alreadyPresent?: boolean }>;
};
const DeviceAccount = registerPlugin<KingsHallAccountPlugin>('KingsHallAccount');
async function registerDeviceAccount(user: User) {
  if (!Capacitor.isNativePlatform()) return;
  await DeviceAccount.addAccount({ email: user.email, username: user.username, displayName: user.name });
}
async function api(path: string, body?: unknown, access?: string): Promise<Result> {
  if (!API) throw new Error('KingsHall API address is not configured yet. Set VITE_API_BASE_URL in the frontend deployment to your ApiKingsHall service URL.');
  let response: Response;
  try { response = await fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : {'Content-Type':'application/json'}), ...(access ? {Authorization:'Bearer '+access} : {}) }, ...(body === undefined ? {} : {body:JSON.stringify(body)}) }); }
  catch { throw new Error('Could not reach ApiKingsHall. Check the connection and API deployment.'); }
  const data = await response.json().catch(()=>({})) as Result;
  if (!response.ok) { const err = new Error(data.error || 'Request failed.') as Error & {code?:string;email?:string}; err.code=data.code; err.email=data.email; throw err; }
  return data;
}
function store(data: Result) { if(data.accessToken) sessionStorage.setItem('kh_access',data.accessToken); if(data.refreshToken) sessionStorage.setItem('kh_refresh',data.refreshToken); }
function clear() { sessionStorage.removeItem('kh_access'); sessionStorage.removeItem('kh_refresh'); }
function ArrowIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>; }
function KingsHallMark() {
 return <svg className="kh-brand-mark-svg" viewBox="0 0 64 64" role="img" aria-label="KingsHall identity mark">
  <path d="M13 55V28a19 19 0 0 1 38 0v27" fill="none" stroke="#eaf5f7" strokeWidth="4.2" strokeLinecap="round"/>
  <path d="M23 50V22M23 36l19-15M27 34l16 16" fill="none" stroke="#eaf5f7" strokeWidth="4.5" strokeLinecap="square"/>
  <path d="m32 5 3.1 6.2 6.9 1-5 4.8 1.2 6.8-6.2-3.2-6.2 3.2 1.2-6.8-5-4.8 6.9-1Z" fill="#82d9e8"/>
  <circle cx="13" cy="28" r="2.2" fill="#82d9e8"/><circle cx="51" cy="28" r="2.2" fill="#82d9e8"/>
 </svg>;
}
function FeatureIcon({type}:{type:'lock'|'people'|'shield'}) {
 if(type==='lock')return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
 if(type==='people')return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.5a3 3 0 0 1 0 5.8M18 14a5.5 5.5 0 0 1 3.5 5"/></svg>;
 return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 19 6v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
}
export default function App() {
 const [mode,setMode]=useState<Mode>('login');
 const [notice,setNotice]=useState(''); const [success,setSuccess]=useState(false); const [busy,setBusy]=useState(false);
 const [verifyEmail,setVerifyEmail]=useState(''); const [user,setUser]=useState<User|null>(null);
 useEffect(()=>{let active=true;const refresh=sessionStorage.getItem('kh_refresh');if(refresh)api('/api/auth/refresh',{refreshToken:refresh}).then(data=>{if(!active)return;store(data);setUser(data.user||null);if(data.user)setMode('account');}).catch(()=>clear());return()=>{active=false;};},[]);
 function say(s:string,ok=false){setNotice(s);setSuccess(ok);}
 function change(next:Mode){setMode(next);setNotice('');}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);say('');
  const f=new FormData(e.currentTarget);
  try{
   if(mode==='signup'){
    const data=await api('/api/auth/signup',{name:f.get('name'),username:f.get('username'),email:f.get('email'),password:f.get('password')});
    setVerifyEmail(data.email||String(f.get('email')||'').trim().toLowerCase());setMode('verify');say(data.message||'Enter the code sent to your email.',true);
   }else if(mode==='verify'){
    const data=await api('/api/auth/verify-email',{email:verifyEmail,code:f.get('code')});setMode('login');say(data.message||'Email verified. You can sign in.',true);
   }else if(mode==='login'){
    const identity=String(f.get('identity')||'');
    try{const data=await api('/api/auth/login',{identity,password:f.get('password')});store(data);setUser(data.user||null);setMode('account');if(data.user){try{await registerDeviceAccount(data.user);say(data.message||'Signed in successfully. KingsHall was added to your Android accounts.',true);}catch{say('Signed in successfully, but Android could not add the device account. You can still use KingsHall; please report this issue.');}}else{say(data.message||'Signed in successfully.',true);}}
    catch(err){const x=err as Error&{code?:string;email?:string};if(x.code==='EMAIL_NOT_VERIFIED'){setVerifyEmail(x.email||(identity.includes('@')?identity.trim().toLowerCase():''));setMode('verify');}throw err;}
   }
  }catch(err){const x=err as Error&{code?:string;email?:string};if(x.code==='EMAIL_DELIVERY_FAILED'&&x.email){setVerifyEmail(x.email);setMode('verify');}say(x.message||'Request failed.');}
  finally{setBusy(false);}
 }
 async function resend(){if(busy||!verifyEmail)return;setBusy(true);say('');try{const d=await api('/api/auth/resend-verification',{email:verifyEmail});say(d.message||'If eligible, a new code has been sent.',true);}catch(e){say((e as Error).message);}finally{setBusy(false);}}
 async function logout(){const refreshToken=sessionStorage.getItem('kh_refresh');setBusy(true);try{await api('/api/auth/logout',{refreshToken});}catch{}clear();setUser(null);setMode('login');setBusy(false);say('You have signed out.',true);}
 return <main className="shell">
  <header className="topbar"><a className="brand" href="#home" aria-label="KingsHall home"><span className="brand-mark"><KingsHallMark/></span><span>KingsHall</span></a><span className="top-note">One identity · Endless possibilities</span></header>
  <section className="layout" id="home" aria-label="KingsHall welcome and account access">
   <div className="intro"><span className="eyebrow">Your next chapter starts here</span><h1>Your world.<br/><span>One home.</span></h1><p className="intro-copy">Welcome to KingsHall — a home for your digital identity and the experiences you’ll connect to it. Start here, and build from a foundation designed around you.</p><div className="feature-list"><div className="feature"><span className="feature-icon"><FeatureIcon type="lock"/></span><span>Designed with privacy and security in mind</span></div><div className="feature"><span className="feature-icon"><FeatureIcon type="people"/></span><span>A starting point for your connected apps</span></div><div className="feature"><span className="feature-icon"><FeatureIcon type="shield"/></span><span>Email verification and protected sessions</span></div></div></div>
   <section className="auth-card" aria-labelledby="form-title"><div className="card-top"><span className="card-symbol"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span><span className="secure"><span className="secure-dot"/>{mode==='account'?'SIGNED IN':'SECURE ACCOUNT'}</span></div>
    <h2 id="form-title">{mode==='login'?'Welcome to KingsHall':mode==='signup'?'Create your account':mode==='verify'?'Verify your email':`Welcome, ${user?.name?.split(' ')[0]||'back'}`}</h2>
    <p className="card-subtitle">{mode==='login'?'Sign in to continue to your space.':mode==='signup'?'Create your KingsHall identity.':mode==='verify'?`Enter the six-digit code sent to ${verifyEmail||'your email'}.`:'Your KingsHall identity is ready.'}</p>
    {(mode==='login'||mode==='signup')&&<div className="tabs" role="tablist" aria-label="Choose login or signup"><button className="tab" type="button" role="tab" aria-selected={mode==='login'} onClick={()=>change('login')}>Log in</button><button className="tab" type="button" role="tab" aria-selected={mode==='signup'} onClick={()=>change('signup')}>Sign up</button></div>}
    {notice&&<div className={success?'notice notice-success':'notice'} role="status" aria-live="polite">{notice}</div>}
    {mode==='login'&&<form onSubmit={submit}><div className="field"><label htmlFor="login-identity">Email or username</label><input id="login-identity" name="identity" autoComplete="username" placeholder="Enter your email or username" required/></div><div className="field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required/></div><button className="submit" type="submit" disabled={busy}>{busy?'Please wait…':'Log in'} <ArrowIcon/></button></form>}
    {mode==='signup'&&<form onSubmit={submit}><div className="field"><label htmlFor="signup-name">Full name</label><input id="signup-name" name="name" autoComplete="name" minLength={2} maxLength={80} placeholder="Enter your full name" required/></div><div className="field"><label htmlFor="signup-username">Username</label><input id="signup-username" name="username" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_.]+" placeholder="Choose a username" required/></div><div className="field"><label htmlFor="signup-email">Email address</label><input id="signup-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required/></div><div className="field"><label htmlFor="signup-password">Create password</label><input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder="12+ characters, upper/lower, number, symbol" required/></div><p className="field-hint">Use at least 12 characters with uppercase and lowercase letters, a number, and a symbol.</p><button className="submit" type="submit" disabled={busy}>{busy?'Creating account…':'Create account'} <ArrowIcon/></button></form>}
    {mode==='verify'&&<><form onSubmit={submit}><div className="field"><label htmlFor="verify-code">Six-digit code</label><input id="verify-code" name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" placeholder="000000" required/></div><button className="submit" type="submit" disabled={busy}>{busy?'Verifying…':'Verify email'} <ArrowIcon/></button></form><button className="tab resend" type="button" disabled={busy} onClick={resend}>Resend verification code</button><button className="tab resend" type="button" onClick={()=>change('signup')}>Back to sign up</button></>}
    {mode==='account'&&<div className="account-panel"><p><strong>{user?.name}</strong></p><p>@{user?.username}</p><p>{user?.email}</p><button className="submit" type="button" disabled={busy} onClick={logout}>Sign out <ArrowIcon/></button></div>}
    <p className="fine-print">Keep your password private. KingsHall will never ask you to share your verification code with another person.</p>
   </section>
  </section>
  <footer className="footer"><span>© {new Date().getFullYear()} KingsHall</span><span className="footer-right"><FeatureIcon type="shield"/> Secure account foundation</span></footer>
 </main>;
}
