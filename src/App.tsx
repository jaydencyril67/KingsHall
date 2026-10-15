import { useState } from 'react';
import type { FormEvent } from 'react';
import './App.css';

type Mode = 'login' | 'signup';

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function CrownMark() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 9.5 6.5 12 12 5l5.5 7L21 9.5l-2 10H5L3 9.5Z" /><path d="M7 16h10" /></svg>;
}
function FeatureIcon({ type }: { type: 'lock' | 'people' | 'shield' }) {
  if (type === 'lock') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
  if (type === 'people') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.5a3 3 0 0 1 0 5.8M18 14a5.5 5.5 0 0 1 3.5 5" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 19 6v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
}
export default function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [notice, setNotice] = useState('');
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('The landing page is ready, but authentication is intentionally not connected yet. No details were sent or saved.');
  }
  function changeMode(next: Mode) {
    setMode(next);
    setNotice('');
  }
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="KingsHall home"><span className="brand-mark"><CrownMark /></span><span>KingsHall</span></a>
        <span className="top-note">One identity · Endless possibilities</span>
      </header>
      <section className="layout" id="home" aria-label="KingsHall welcome and account access">
        <div className="intro">
          <span className="eyebrow">Your next chapter starts here</span>
          <h1>Your world.<br /><span>One home.</span></h1>
          <p className="intro-copy">Welcome to KingsHall — a home for your digital identity and the experiences you’ll connect to it. Start here, and build from a foundation designed around you.</p>
          <div className="feature-list">
            <div className="feature"><span className="feature-icon"><FeatureIcon type="lock" /></span><span>Designed with privacy and security in mind</span></div>
            <div className="feature"><span className="feature-icon"><FeatureIcon type="people" /></span><span>A starting point for your connected apps</span></div>
            <div className="feature"><span className="feature-icon"><FeatureIcon type="shield" /></span><span>A clean foundation, built one step at a time</span></div>
          </div>
        </div>
        <section className="auth-card" aria-labelledby="form-title">
          <div className="card-top">
            <span className="card-symbol"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg></span>
            <span className="secure"><span className="secure-dot" /> FOUNDATION MODE</span>
          </div>
          <h2 id="form-title">{mode === 'login' ? 'Welcome to KingsHall' : 'Create your account'}</h2>
          <p className="card-subtitle">{mode === 'login' ? 'Sign in to continue to your space.' : 'Set up your place in the KingsHall world.'}</p>
          <div className="tabs" role="tablist" aria-label="Choose login or signup">
            <button className="tab" type="button" role="tab" aria-selected={mode === 'login'} onClick={() => changeMode('login')}>Log in</button>
            <button className="tab" type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => changeMode('signup')}>Sign up</button>
          </div>
          {notice && <div className="notice" role="status" aria-live="polite">{notice}</div>}
          {mode === 'login' ? (
            <form onSubmit={handleSubmit}>
              <div className="field"><label htmlFor="login-identity">Email or username</label><input id="login-identity" name="identity" type="text" autoComplete="username" placeholder="Enter your email or username" required /></div>
              <div className="field"><div className="password-row"><label htmlFor="login-password">Password</label><span className="small-note">Not connected yet</span></div><input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></div>
              <button className="submit" type="submit">Log in <ArrowIcon /></button>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field"><label htmlFor="signup-name">Full name</label><input id="signup-name" name="name" type="text" autoComplete="name" placeholder="Enter your full name" required /></div>
              <div className="field"><label htmlFor="signup-username">Username</label><input id="signup-username" name="username" type="text" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_.]+" placeholder="Choose a username" required /></div>
              <div className="field"><label htmlFor="signup-email">Email address</label><input id="signup-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div>
              <div className="field"><div className="password-row"><label htmlFor="signup-password">Create password</label><span className="small-note">Demo only</span></div><input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={12} placeholder="At least 12 characters" required /></div>
              <button className="submit" type="submit">Create account <ArrowIcon /></button>
            </form>
          )}
          <p className="fine-print">This page does not send, save, or verify account details yet.<br />Authentication will be added as a separate, tested step.</p>
        </section>
      </section>
      <footer className="footer"><span>© {new Date().getFullYear()} KingsHall</span><span className="footer-right"><FeatureIcon type="shield" /> New foundation · No backend connected</span></footer>
    </main>
  );
}
