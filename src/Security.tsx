import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import Toast from './Toast';
import LoadingDots from './components/LoadingDots';
import AccountVerification from './AccountVerification';
import { createPasskey, isWebAuthnAvailable } from './webauthn';

type Profile = {
  securityCodeChangedAt?: string | null; accessCodeChangedAt?: string | null;
  id?: string; kui?: string; firstName?: string; middleName?: string; lastName?: string; username?: string; email?: string;
  dateOfBirth?: string; phone?: string; country?: string; state?: string; city?: string; address?: string;
  postalCode?: string; nationality?: string; gender?: string; occupation?: string; bio?: string; avatarData?: string; coverPhoto?: string;
  website?: string; instagram?: string; facebook?: string; xHandle?: string; telegram?: string; discord?: string;
  linkedin?: string; language?: string; timeZone?: string; preferredCurrency?: string; pronouns?: string;
  relationshipStatus?: string; securityCodeSet?: boolean; accessCodeSet?: boolean;
};
type Props = { user: { id: string; name: string; username: string; email: string; isEmailVerified: boolean } | null };
type ResponseData = { profile?: Profile; message?: string; error?: string; securityCodeSet?: boolean; accessCodeSet?: boolean; enabled?: boolean; loginEnabled?: boolean; configured?: boolean; credentialCount?: number; pending?: boolean; secret?: string };
const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');
type AndroidAccountPlugin = {
  listAccounts(): Promise<{ accounts: string[] }>;
  removeAccount(options: { email: string }): Promise<void>;
};
const AndroidAccounts = registerPlugin<AndroidAccountPlugin>('KingsHallAccount');
const SAVED_ACCOUNTS_KEY = 'kh_saved_accounts';
const REMOVED_ACCOUNTS_KEY = 'kh_removed_accounts';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function readCookieList(key: string): string[] {
  const item = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(key + '='));
  if (!item) return [];
  try {
    const value = JSON.parse(decodeURIComponent(item.slice(key.length + 1)));
    return Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string').map(entry => entry.trim().toLowerCase()).filter(entry => EMAIL_PATTERN.test(entry)))] : [];
  } catch { return []; }
}
function writeCookieList(key: string, values: string[], maxAge = 31536000) {
  document.cookie = key + '=' + encodeURIComponent(JSON.stringify(values)) + '; Domain=.kingshall.online; Path=/; Max-Age=' + maxAge + '; Secure; SameSite=Lax';
}
function readBrowserAccounts(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    const removed = new Set(readCookieList(REMOVED_ACCOUNTS_KEY));
    return [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim().toLowerCase()).filter(item => EMAIL_PATTERN.test(item) && !removed.has(item)))].slice(0, 10);
  } catch { return []; }
}
function writeBrowserAccounts(accounts: string[]) {
  const normalized = [...new Set(accounts.map(item => item.trim().toLowerCase()).filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)))].slice(0, 10);
  window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(normalized));
  writeCookieList('kh_saved_accounts', normalized);
  return normalized;
}
function codeCooldownRemaining(changedAt: string | null | undefined, cooldownMs = 30 * 24 * 60 * 60 * 1000): number {
  if (!changedAt) return 0;
  const changedTime = new Date(changedAt).getTime();
  return Number.isFinite(changedTime) ? Math.max(0, changedTime + cooldownMs - Date.now()) : 0;
}
function formatCodeCooldown(milliseconds: number): string {
  const totalHours = Math.ceil(milliseconds / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? days + ' day' + (days === 1 ? '' : 's') + (hours ? ' ' + hours + 'h' : '') : totalHours + ' hour' + (totalHours === 1 ? '' : 's');
}

async function request(path: string, body?: unknown): Promise<ResponseData> {
  const makeRequest = (token: string | null) => fetch(API + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  let response: Response;
  try { response = await makeRequest(sessionStorage.getItem('kh_access')); }
  catch { throw new Error('Could not reach ApiKingsHall. Check your connection and try again.'); }
  if (response.status === 401 && path !== '/api/auth/refresh') {
    const refreshToken = sessionStorage.getItem('kh_refresh');
    if (refreshToken) {
      try {
        const refresh = await fetch(API + '/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
        const session = await refresh.json().catch(() => ({})) as { accessToken?: string; refreshToken?: string };
        if (refresh.ok && session.accessToken && session.refreshToken) {
          sessionStorage.setItem('kh_access', session.accessToken);
          sessionStorage.setItem('kh_refresh', session.refreshToken);
          response = await makeRequest(session.accessToken);
        }
      } catch { /* Keep the original response for a useful error. */ }
    }
  }
  const data = await response.json().catch(() => ({})) as ResponseData;
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

export default function SecurityPage({ user }: Props) {
  const [savedBrowserAccounts, setSavedBrowserAccounts] = useState<string[]>(() => Capacitor.isNativePlatform() ? [] : readBrowserAccounts());
  const [savedAndroidAccounts, setSavedAndroidAccounts] = useState<string[]>([]);
  const [browserAccountActionMenuEmail, setBrowserAccountActionMenuEmail] = useState<string | null>(null);
  const [androidAccountActionMenuEmail, setAndroidAccountActionMenuEmail] = useState<string | null>(null);
  const [removingAndroidAccount, setRemovingAndroidAccount] = useState(false);
  const [accountRemovalConfirmation, setAccountRemovalConfirmation] = useState<{ email: string; platform: 'android' | 'browser' } | null>(null);
  async function refreshAndroidAccounts() {
    const result = await AndroidAccounts.listAccounts();
    setSavedAndroidAccounts([...new Set((result.accounts || []).filter(email => typeof email === 'string' && EMAIL_PATTERN.test(email)).map(email => email.trim().toLowerCase()))].slice(0, 10));
  }
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.getPlatform() === 'android') void refreshAndroidAccounts().catch(error => {
        setNotice((error as Error).message || 'Could not read Android saved accounts.');
        setNoticeOk(false);
      });
      return;
    }
    const accounts = writeBrowserAccounts(readBrowserAccounts());
    setSavedBrowserAccounts(accounts);
  }, []);
  const [kui, setKui] = useState('');
  const [securityDraft, setSecurityDraft] = useState({ password: '', kui: '', securityCode: '', accessCode: '', twoFactor: '' });
  const [loading, setLoading] = useState(true);
  const [savingSecuritySettings, setSavingSecuritySettings] = useState(false);
  const [activeSecurityField, setActiveSecurityField] = useState<'password' | 'securityCode' | 'accessCode' | null>(null);
  const [securityFieldMenu, setSecurityFieldMenu] = useState<'password' | 'securityCode' | 'accessCode' | null>(null);
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [securityCodeSet, setSecurityCodeSet] = useState(false);
  const [accessCodeSet, setAccessCodeSet] = useState(false);
  const [securityCodeChangedAt, setSecurityCodeChangedAt] = useState<string | null>(null);
  const [accessCodeChangedAt, setAccessCodeChangedAt] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoginEnabled, setTwoFactorLoginEnabled] = useState(false);
  const [biometricConfigured, setBiometricConfigured] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorCancelBusy, setTwoFactorCancelBusy] = useState(false);
  const [twoFactorVerifyBusy, setTwoFactorVerifyBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);

  useEffect(() => {
    const closeNetworkSelector = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.kh-account-removal-confirm-popout')) return;
      if (target instanceof Element && target.closest('.kh-security-code-input-wrap')) return;
      if (!(target instanceof Element && target.closest('.kh-security-browser-account'))) { setBrowserAccountActionMenuEmail(null); setAndroidAccountActionMenuEmail(null); }
      setSecurityFieldMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBrowserAccountActionMenuEmail(null);
        setAndroidAccountActionMenuEmail(null);
        setAccountRemovalConfirmation(current => removingAndroidAccount ? current : null);
      }
    };
    document.addEventListener('pointerdown', closeNetworkSelector);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeNetworkSelector);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    let current = true;
    Promise.all([request('/api/identity'), request('/api/identity/2fa/status'), request('/api/identity/biometric/status')]).then(([data, twoFactor, biometric]) => {
      if (!current) return;
      setKui(data.profile?.kui || '');
      setSecurityCodeSet(Boolean(data.profile?.securityCodeSet));
      setAccessCodeSet(Boolean(data.profile?.accessCodeSet));
      setSecurityCodeChangedAt(data.profile?.securityCodeChangedAt || null);
      setAccessCodeChangedAt(data.profile?.accessCodeChangedAt || null);
      setTwoFactorEnabled(Boolean(twoFactor.enabled));
      setTwoFactorPending(Boolean(twoFactor.pending));
      setTwoFactorLoginEnabled(Boolean(twoFactor.loginEnabled));
      setBiometricConfigured(Boolean(biometric.configured));
      setBiometricEnabled(Boolean(biometric.enabled));
    }).catch(error => {
      if (current) { setNotice((error as Error).message || 'Could not load your security details.'); setNoticeOk(false); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user?.id]);

  const securityCodeCooldownMs = codeCooldownRemaining(securityCodeChangedAt);
  const accessCodeCooldownMs = codeCooldownRemaining(accessCodeChangedAt, 24 * 60 * 60 * 1000);

  const passwordValid = securityDraft.password.length >= 12 && securityDraft.password.length <= 128 && /[a-z]/.test(securityDraft.password) && /[A-Z]/.test(securityDraft.password) && /[0-9]/.test(securityDraft.password) && /[^A-Za-z0-9]/.test(securityDraft.password);

  async function requestSecurityVerification() {
    if (!activeSecurityField || savingSecuritySettings) return;
    setSavingSecuritySettings(true); setNotice('');
    try {
      const result = await request('/api/identity/security-change/request', {});
      setVerificationRequested(true);
      setEmailVerificationCode('');
      setNotice(result.message || 'Verification code sent to your verified email.'); setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Could not send verification code.'); setNoticeOk(false); }
    finally { setSavingSecuritySettings(false); }
  }

  async function saveActiveSecurityField() {
    if (!activeSecurityField || savingSecuritySettings) return;
    if (!/^\d{6}$/.test(emailVerificationCode)) { setNotice('Enter the six-digit code sent to your email.'); setNoticeOk(false); return; }
    const field = activeSecurityField;
    if (field === 'password' && !passwordValid) { setNotice('Password must be 12–128 characters and include uppercase, lowercase, a number and a symbol.'); setNoticeOk(false); return; }
    if (field === 'securityCode' && !/^\\d{8}$/.test(securityDraft.securityCode)) { setNotice('Security Code must contain exactly 8 digits.'); setNoticeOk(false); return; }
    if (field === 'accessCode' && !/^\d{6}$/.test(securityDraft.accessCode)) { setNotice('Access Code must contain exactly 6 digits.'); setNoticeOk(false); return; }
    setSavingSecuritySettings(true); setNotice('');
    try {
      if (field === 'password') {
        const result = await request('/api/auth/change-password', {
          password: securityDraft.password, emailVerificationCode,
          refreshToken: sessionStorage.getItem('kh_refresh') || ''
        });
        setNotice(result.message || 'Password updated successfully.');
      } else {
        const payload = {
          emailVerificationCode,
          ...(field === 'securityCode' ? { securityCode: securityDraft.securityCode } : {}),
          ...(field === 'accessCode' ? { accessCode: securityDraft.accessCode } : {})
        };
        const result = await request('/api/identity/security-settings', payload);
        setSecurityCodeSet(Boolean(result.securityCodeSet)); setAccessCodeSet(Boolean(result.accessCodeSet));
        const changedAt = new Date().toISOString();
        if (field === 'securityCode') setSecurityCodeChangedAt(changedAt);
        if (field === 'accessCode') setAccessCodeChangedAt(changedAt);
        setNotice(result.message || 'Security setting updated.');
      }
      setSecurityDraft(old => ({ ...old, [field]: '' }));
      setActiveSecurityField(null); setEmailVerificationCode(''); setVerificationRequested(false); setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Could not save this security setting.'); setNoticeOk(false); }
    finally { setSavingSecuritySettings(false); }
  }

  function cancelSecurityEdit() {
    if (activeSecurityField) setSecurityDraft(old => ({ ...old, [activeSecurityField]: '' }));
    setActiveSecurityField(null); setEmailVerificationCode(''); setVerificationRequested(false);
  }

  function renderSecurityVerificationPanel(field: 'password' | 'securityCode' | 'accessCode') {
    if (activeSecurityField !== field) return null;
    return <div className="kh-security-verification-panel">
      {!verificationRequested ? <>
        <button type="button" className="submit-button kh-security-verification-action" disabled={savingSecuritySettings} onClick={() => void requestSecurityVerification()}>{savingSecuritySettings ? <LoadingDots /> : 'Send code'}</button>
        <button type="button" className="secondary-button kh-security-verification-action" disabled={savingSecuritySettings} onClick={cancelSecurityEdit}>Cancel</button>
      </> : <>
        <input className="kh-security-verification-code-input" aria-label="Email verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter 6-digit code" value={emailVerificationCode} onChange={e => setEmailVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        <button type="button" className="submit-button kh-security-verification-action" disabled={savingSecuritySettings || emailVerificationCode.length !== 6} onClick={() => void saveActiveSecurityField()}>{savingSecuritySettings ? <LoadingDots /> : 'Verify'}</button>
        <small className="kh-security-verification-help">Check your verified KingsHall email. The code expires in 10 minutes.</small>
      </>}
    </div>;
  }


  async function setAuthenticatorLoginRequirement(enabled: boolean) {
    try { const result=await request('/api/identity/2fa/login-setting',{enabled}); setTwoFactorLoginEnabled(Boolean(result.loginEnabled)); setNotice(result.message||'Authenticator sign-in setting updated.'); setNoticeOk(true); }
    catch(error) { setNotice((error as Error).message||'Could not update authenticator sign-in setting.'); setNoticeOk(false); }
  }
  async function configureBiometric() {
    if(biometricBusy)return;
    if(!isWebAuthnAvailable()){setNotice('Passkeys are not available in this browser or app build.');setNoticeOk(false);return;}
    setBiometricBusy(true);setNotice('');
    try { const options=await request('/api/identity/biometric/registration/options',{}); const credential=await createPasskey(options); const result=await request('/api/identity/biometric/registration/verify',credential); setBiometricConfigured(true);setBiometricEnabled(false);setNotice(result.message||'Passkey configured. Enable it to require biometric verification at sign-in.');setNoticeOk(true); }
    catch(error) { setNotice((error as Error).message||'Could not configure biometric sign-in.');setNoticeOk(false); }
    finally { setBiometricBusy(false); }
  }
  async function setBiometricLoginRequirement(enabled: boolean) {
    if(biometricBusy)return;setBiometricBusy(true);
    try { const result=await request('/api/identity/biometric/login-setting',{enabled});setBiometricEnabled(Boolean(result.enabled));setNotice(result.message||'Biometric sign-in setting updated.');setNoticeOk(true); }
    catch(error) { setNotice((error as Error).message||'Could not update biometric sign-in setting.');setNoticeOk(false); }
    finally { setBiometricBusy(false); }
  }
  async function unbindBiometric() {
    if(biometricBusy)return;if(!window.confirm('Remove the passkey from KingsHall and disable biometric sign-in?'))return;setBiometricBusy(true);
    try { const result=await request('/api/identity/biometric/unbind',{});setBiometricConfigured(false);setBiometricEnabled(false);setNotice(result.message||'Passkey removed.');setNoticeOk(true); }
    catch(error) { setNotice((error as Error).message||'Could not remove passkey.');setNoticeOk(false); }
    finally { setBiometricBusy(false); }
  }

  async function startAuthenticator() {
    if (twoFactorBusy) return;
    setTwoFactorBusy(true);
    try {
      const result = await request('/api/identity/2fa/setup', {});
      setTwoFactorSecret(result.secret || '');
      setTwoFactorPending(true);
      setTwoFactorCode('');
      setNotice(result.message || 'Enter the setup key in your authenticator app.'); setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Could not start setup.'); setNoticeOk(false); }
    finally { setTwoFactorBusy(false); }
  }

  async function copyAuthenticatorSecret() {
    if (!twoFactorSecret) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.');
      await navigator.clipboard.writeText(twoFactorSecret);
      setNotice('Authenticator setup key copied to clipboard. Keep it private.');
      setNoticeOk(true);
    } catch (error) {
      setNotice((error as Error).message || 'Could not copy the setup key. You can select and copy it manually.');
      setNoticeOk(false);
    }
  }

  async function verifyAuthenticator() {
    if (twoFactorVerifyBusy || twoFactorCancelBusy || twoFactorBusy) return;
    if (!/^\d{6}$/.test(twoFactorCode)) { setNotice('Enter the six-digit authenticator code.'); setNoticeOk(false); return; }
    setTwoFactorVerifyBusy(true);
    try {
      const result = await request('/api/identity/2fa/verify', { code: twoFactorCode });
      setTwoFactorEnabled(true); setTwoFactorPending(false); setTwoFactorSecret(''); setTwoFactorCode('');
      setNotice(result.message || 'Authenticator bound successfully.'); setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Code verification failed.'); setNoticeOk(false); }
    finally { setTwoFactorVerifyBusy(false); }
  }

  async function cancelAuthenticatorSetup() {
    if (twoFactorCancelBusy || twoFactorVerifyBusy || twoFactorBusy) return;
    setTwoFactorCancelBusy(true);
    setNotice('');
    try {
      const result = await request('/api/identity/2fa/cancel', {});
      setTwoFactorPending(false);
      setTwoFactorSecret('');
      setTwoFactorCode('');
      setNotice(result.message || 'Authenticator setup cancelled.');
      setNoticeOk(true);
    } catch (error) {
      setNotice((error as Error).message || 'Could not cancel authenticator setup.');
      setNoticeOk(false);
    } finally { setTwoFactorCancelBusy(false); }
  }

  async function removeAuthenticator() {
    if (!/^\d{6}$/.test(twoFactorCode)) { setNotice('Enter the current six-digit authenticator code.'); setNoticeOk(false); return; }
    setTwoFactorBusy(true);
    try {
      const result = await request('/api/identity/2fa/disable', { code: twoFactorCode });
      setTwoFactorEnabled(false); setTwoFactorLoginEnabled(false); setTwoFactorPending(false); setTwoFactorSecret(''); setTwoFactorCode('');
      setNotice(result.message || 'Authenticator unbound.'); setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Could not unbind authenticator.'); setNoticeOk(false); }
    finally { setTwoFactorBusy(false); }
  }

  async function confirmSavedAccountRemoval(): Promise<void> {
    const pending = accountRemovalConfirmation;
    if (!pending) return;
    setAccountRemovalConfirmation(null);
    const email = pending.email;
    if (pending.platform === 'android') {
      if (removingAndroidAccount) return;
      setRemovingAndroidAccount(true); setNotice('');
      try {
        await AndroidAccounts.removeAccount({ email });
        setSavedAndroidAccounts(current => current.filter(item => item !== email));
        setNotice('KingsHall account removed from Android Account Manager.'); setNoticeOk(true);
      } catch (error) {
        setNotice((error as Error).message || 'Could not remove the saved Android account.'); setNoticeOk(false);
      } finally { setRemovingAndroidAccount(false); }
      return;
    }
    const removed = [...new Set([...readCookieList(REMOVED_ACCOUNTS_KEY), email])].slice(-50);
    writeCookieList(REMOVED_ACCOUNTS_KEY, removed);
    const remaining = writeBrowserAccounts(savedBrowserAccounts.filter(item => item !== email));
    setSavedBrowserAccounts(remaining);
    let currentHint = '';
    const hintCookie = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith('kh_account_hint='));
    if (hintCookie) { try { currentHint = decodeURIComponent(hintCookie.slice('kh_account_hint='.length)).trim().toLowerCase(); } catch {} }
    if (currentHint === email) {
      document.cookie = 'kh_account_hint=; Domain=.kingshall.online; Path=/; Max-Age=0; Secure; SameSite=Lax';
      localStorage.removeItem('kingshall_account_hint');
    }
    setNotice('Saved account removed from this browser.'); setNoticeOk(true);
  }

  return <div className="kh-identity-page kh-security-page">
    <div className="kh-identity-heading">
      <span className="eyebrow"><span className="eyebrow-line" />ACCOUNT PROTECTION</span>
      <h1>KingsHall <em>Security.</em></h1>
      <p>Manage your account-protection settings from one dedicated page.</p>
    </div>
    <Toast message={notice} tone={noticeOk ? 'success' : 'error'} onClose={() => setNotice('')} />

      {Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' ? <section className="kh-identity-card kh-security-browser-accounts">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon /></span><div><h2>Saved Android accounts</h2><p>Manage KingsHall accounts saved in Android Account Manager on this device. Removing one deletes its saved device account and refresh credential; it does not log out your current in-app session.</p></div></div>
        {savedAndroidAccounts.length > 0 ? <div className="kh-security-browser-account-list">
          {savedAndroidAccounts.map(email => <div className="kh-security-browser-account" key={email}>
            <button type="button" className="kh-security-browser-account-trigger" aria-expanded={androidAccountActionMenuEmail === email} onClick={() => setAndroidAccountActionMenuEmail(current => current === email ? null : email)}>
              <span className="kh-security-browser-account-email">{email}</span><span className="kh-security-browser-account-chevron" aria-hidden="true">⌄</span>
            </button>
            {androidAccountActionMenuEmail === email && <div className="kh-account-actions-popout kh-security-browser-account-popout" role="group" aria-label="Saved Android account actions">
              <button type="button" className="is-danger" disabled={removingAndroidAccount} onClick={event => {
                event.stopPropagation();
                setAccountRemovalConfirmation({ email, platform: 'android' });
                setAndroidAccountActionMenuEmail(null);
              }}>Remove account</button>
            </div>}
            {accountRemovalConfirmation?.email === email && accountRemovalConfirmation.platform === 'android' && <div className="kh-account-actions-popout kh-security-browser-account-popout kh-account-removal-confirm-popout" role="alertdialog" aria-label="Confirm saved account removal" aria-modal="false">
              <strong>Remove saved account?</strong>
              <p>Remove <span className="kh-account-removal-email">{email}</span> from KingsHall accounts saved on this device? Its saved device credential will be deleted, but your current session will stay signed in.</p>
              <div className="kh-account-removal-actions">
                <button type="button" disabled={removingAndroidAccount} onClick={() => setAccountRemovalConfirmation(null)}>Cancel</button>
                <button type="button" className="is-danger" disabled={removingAndroidAccount} onClick={() => void confirmSavedAccountRemoval()}>{removingAndroidAccount ? 'Removing…' : 'Remove account'}</button>
              </div>
            </div>}
          </div>)}
        </div> : <p className="kh-security-browser-accounts-empty">No KingsHall accounts are currently saved in Android Account Manager.</p>}
      </section> : !Capacitor.isNativePlatform() && <section className="kh-identity-card kh-security-browser-accounts">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon /></span><div><h2>Saved browser accounts</h2><p>Manage accounts saved on this browser. You can remove an account here; sign-in and account selection happen in the connected app.</p></div></div>
        {savedBrowserAccounts.length > 0 ? <div className="kh-security-browser-account-list">
          {savedBrowserAccounts.map(email => <div className="kh-security-browser-account" key={email}>
            <button type="button" className="kh-security-browser-account-trigger" aria-expanded={browserAccountActionMenuEmail === email} onClick={() => setBrowserAccountActionMenuEmail(current => current === email ? null : email)}>
              <span className="kh-security-browser-account-email">{email}</span><span className="kh-security-browser-account-chevron" aria-hidden="true">⌄</span>
            </button>
            {browserAccountActionMenuEmail === email && <div className="kh-account-actions-popout kh-security-browser-account-popout" role="group" aria-label="Saved account actions">
              <button type="button" className="is-danger" onClick={event => {
                event.stopPropagation();
                setAccountRemovalConfirmation({ email, platform: 'browser' });
                setBrowserAccountActionMenuEmail(null);
              }}>Remove</button>
            </div>}
            {accountRemovalConfirmation?.email === email && accountRemovalConfirmation.platform === 'browser' && <div className="kh-account-actions-popout kh-security-browser-account-popout kh-account-removal-confirm-popout" role="alertdialog" aria-label="Confirm saved account removal" aria-modal="false">
              <strong>Remove saved account?</strong>
              <p>Remove <span className="kh-account-removal-email">{email}</span> from KingsHall accounts saved in this browser? This only removes the saved account entry from this browser.</p>
              <div className="kh-account-removal-actions">
                <button type="button" onClick={() => setAccountRemovalConfirmation(null)}>Cancel</button>
                <button type="button" className="is-danger" onClick={() => void confirmSavedAccountRemoval()}>Remove account</button>
              </div>
            </div>}
          </div>)}
        </div> : <p className="kh-security-browser-accounts-empty">No saved browser accounts yet. Sign in to KingsHall on this browser to add one.</p>}
      </section>}

      <section className="kh-identity-card kh-identity-security">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon /></span><div><h2>Account security{loading && <span className="kh-identity-section-loading" aria-label="Loading security details"><LoadingDots /></span>}</h2><p>Manage your account security settings below.</p></div></div>
        <div className="kh-identity-grid kh-identity-security-fields">
          <div className="field kh-security-editable-field">
            <label htmlFor="security-password">Password</label>
            <div className="kh-security-code-input-wrap">
              <input id="security-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder={activeSecurityField === 'password' ? 'Enter a new password' : '••••••••••••'} readOnly={activeSecurityField !== 'password'} onClick={() => { if (activeSecurityField !== 'password') setSecurityFieldMenu('password'); }} value={securityDraft.password} onChange={e => setSecurityDraft(old => ({ ...old, password: e.target.value }))} />
              {activeSecurityField === 'password' && passwordValid && <span className="kh-security-code-check" aria-label="Password meets requirements"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}
              {securityFieldMenu === 'password' && <button type="button" className="kh-security-edit-trigger kh-security-edit-popout" onClick={event => { event.stopPropagation(); setSecurityFieldMenu(null); setActiveSecurityField('password'); setVerificationRequested(false); setEmailVerificationCode(''); setNotice(''); }}>✎ Edit</button>}
            </div>
            {renderSecurityVerificationPanel('password')}
            {activeSecurityField === 'password' && <small className="kh-postal-feedback">12–128 characters, with uppercase, lowercase, a number and a symbol.</small>}
          </div>
          <div className="field kh-security-kui-field"><label htmlFor="security-kui">KUI (6-digit KingsHall Unique ID)</label><input id="security-kui" inputMode="numeric" autoComplete="off" maxLength={6} value={kui} readOnly disabled aria-disabled="true" /></div>
          <div className="field kh-security-editable-field">
            <label htmlFor="security-code">8-digit Security Code</label>
            <div className="kh-security-code-input-wrap">
              <input id="security-code" readOnly={activeSecurityField !== 'securityCode'} disabled={securityCodeSet && securityCodeCooldownMs > 0} onClick={() => { if (securityCodeCooldownMs <= 0 && activeSecurityField !== 'securityCode') setSecurityFieldMenu('securityCode'); }} type={activeSecurityField === 'securityCode' ? 'password' : 'text'} inputMode="numeric" autoComplete="new-password" maxLength={8} placeholder={activeSecurityField === 'securityCode' ? 'Enter a new 8-digit code' : securityCodeSet ? '••••••••' : 'Not set'} value={activeSecurityField === 'securityCode' ? securityDraft.securityCode : (securityCodeSet ? '••••••••' : '')} onChange={e => setSecurityDraft(old => ({ ...old, securityCode: e.target.value.replace(/\D/g, '').slice(0, 8) }))} />
              {securityCodeSet && <span className="kh-security-code-check" aria-label="Code saved"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}
              {securityFieldMenu === 'securityCode' && securityCodeCooldownMs <= 0 && <button type="button" className="kh-security-edit-trigger kh-security-edit-popout" onClick={event => { event.stopPropagation(); setSecurityFieldMenu(null); setActiveSecurityField('securityCode'); setSecurityDraft(old => ({ ...old, securityCode: '' })); setVerificationRequested(false); setEmailVerificationCode(''); setNotice(''); }}>✎ Edit</button>}
            </div>
            {renderSecurityVerificationPanel('securityCode')}
            {securityCodeCooldownMs > 0 && <small className="kh-code-cooldown-note">Change available in {formatCodeCooldown(securityCodeCooldownMs)}.</small>}
          </div>
          <div className="field kh-security-editable-field">
            <label htmlFor="security-access-code">6-digit Access Code</label>
            <div className="kh-security-code-input-wrap">
              <input id="security-access-code" readOnly={activeSecurityField !== 'accessCode'} disabled={accessCodeSet && accessCodeCooldownMs > 0} onClick={() => { if (accessCodeCooldownMs <= 0 && activeSecurityField !== 'accessCode') setSecurityFieldMenu('accessCode'); }} type={activeSecurityField === 'accessCode' ? 'password' : 'text'} inputMode="numeric" autoComplete="new-password" maxLength={6} placeholder={activeSecurityField === 'accessCode' ? 'Enter a new 6-digit code' : accessCodeSet ? '••••••' : 'Not set'} value={activeSecurityField === 'accessCode' ? securityDraft.accessCode : (accessCodeSet ? '••••••' : '')} onChange={e => setSecurityDraft(old => ({ ...old, accessCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
              {accessCodeSet && <span className="kh-security-code-check" aria-label="Code saved"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}
              {securityFieldMenu === 'accessCode' && accessCodeCooldownMs <= 0 && <button type="button" className="kh-security-edit-trigger kh-security-edit-popout" onClick={event => { event.stopPropagation(); setSecurityFieldMenu(null); setActiveSecurityField('accessCode'); setSecurityDraft(old => ({ ...old, accessCode: '' })); setVerificationRequested(false); setEmailVerificationCode(''); setNotice(''); }}>✎ Edit</button>}
            </div>
            {renderSecurityVerificationPanel('accessCode')}
            {accessCodeCooldownMs > 0 && <small className="kh-code-cooldown-note">Change available in {formatCodeCooldown(accessCodeCooldownMs)}.</small>}
          </div>

        </div>

      </section>

      <section className="kh-identity-card kh-identity-security">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon /></span><div><h2>Two-factor authenticator</h2><p>Bind an authenticator app, then enable it separately to require a code at sign-in.</p></div></div>
        <div className="kh-identity-grid kh-identity-security-fields">
          <div className="field kh-two-factor-status-field"><label>Binding status</label><div className="kh-two-factor-status" role="status"><span>{twoFactorEnabled ? 'Bound and verified' : twoFactorPending ? 'Setup pending verification' : 'Not bound'}</span>{twoFactorEnabled && <span className="kh-security-code-check kh-two-factor-status-check" aria-label="Bound and verified"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}</div></div>
          {twoFactorEnabled && <div className="field"><label>Require 2FA at sign-in</label><button type="button" className={twoFactorLoginEnabled ? 'secondary-button' : 'submit-button'} disabled={loading} onClick={() => void setAuthenticatorLoginRequirement(!twoFactorLoginEnabled)}>{twoFactorLoginEnabled ? 'Disable sign-in requirement' : 'Enable at sign-in'}</button><small className="kh-postal-feedback">{twoFactorLoginEnabled ? 'Sign-in will require a current authenticator code.' : 'Authenticator is bound but will not be requested at sign-in until enabled here.'}</small></div>}
          {!twoFactorEnabled && !twoFactorSecret && <div className="field"><label>Authenticator setup</label><button type="button" className="submit-button" disabled={twoFactorBusy} onClick={() => void startAuthenticator()}>{twoFactorBusy ? <LoadingDots /> : twoFactorPending ? 'Restart Setup' : 'Bind Authenticator'}</button></div>}
          {twoFactorSecret && <div className="field"><label htmlFor="kh-two-factor-secret">Setup key</label><div className="kh-two-factor-secret-row"><input id="kh-two-factor-secret" value={twoFactorSecret} readOnly /><button type="button" className="kh-copy-secret-button" aria-label="Copy authenticator setup key" title="Copy setup key" onClick={() => void copyAuthenticatorSecret()}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg></button></div><small className="kh-postal-feedback">In your authenticator app, choose Enter a setup key. Account: {user?.email || 'KingsHall'}. Keep this key private.</small></div>}
          {(twoFactorSecret || twoFactorEnabled) && <div className="field"><label htmlFor="kh-two-factor-code">{twoFactorEnabled ? 'Current code to unbind' : 'Verify authenticator code'}</label><input id="kh-two-factor-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />{twoFactorEnabled ? <button type="button" className="submit-button" disabled={twoFactorBusy || twoFactorCode.length !== 6} onClick={() => void removeAuthenticator()}>{twoFactorBusy ? <LoadingDots /> : 'Unbind Authenticator'}</button> : <div className="kh-two-factor-verify-actions"><button type="button" className="secondary-button kh-two-factor-cancel-button" disabled={twoFactorCancelBusy || twoFactorVerifyBusy || twoFactorBusy} onClick={() => void cancelAuthenticatorSetup()}>{twoFactorCancelBusy ? <LoadingDots /> : 'Cancel'}</button><button type="button" className="submit-button kh-two-factor-verify-button" disabled={twoFactorCancelBusy || twoFactorVerifyBusy || twoFactorBusy || twoFactorCode.length !== 6} onClick={() => void verifyAuthenticator()}>{twoFactorVerifyBusy ? <LoadingDots /> : 'Verify & Bind'}</button></div>}</div>}
          
        </div>

      </section>
      <section className="kh-identity-card kh-identity-security">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon /></span><div><h2>Biometric security</h2><p>Configure a passkey and separately enable it to require biometric verification during KingsHall sign-in.</p></div></div>
        <div className="kh-identity-grid kh-identity-security-fields">
          <div className="field"><label>Passkey status</label><div className="kh-two-factor-status" role="status"><span>{biometricConfigured ? 'Passkey configured' : 'Not configured'}</span>{biometricConfigured && <span className="kh-security-code-check kh-two-factor-status-check" aria-label="Passkey configured"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}</div></div>
          {!biometricConfigured && <div className="field"><label>Set up biometrics</label><button type="button" className="submit-button" disabled={biometricBusy || loading} onClick={() => void configureBiometric()}>{biometricBusy ? <LoadingDots /> : 'Configure passkey'}</button></div>}
          {biometricConfigured && <div className="field"><label>Require biometrics at sign-in</label><button type="button" className={biometricEnabled ? 'secondary-button' : 'submit-button'} disabled={biometricBusy || loading} onClick={() => void setBiometricLoginRequirement(!biometricEnabled)}>{biometricBusy ? <LoadingDots /> : biometricEnabled ? 'Disable sign-in requirement' : 'Enable at sign-in'}</button><small className="kh-postal-feedback">{biometricEnabled ? 'Sign-in will require passkey/biometric verification.' : 'Passkey is configured but is not required until enabled here.'}</small></div>}
          {biometricConfigured && <div className="field"><label>Passkey management</label><button type="button" className="secondary-button" disabled={biometricBusy || loading} onClick={() => void unbindBiometric()}>{biometricBusy ? <LoadingDots /> : 'Remove passkey'}</button></div>}
        </div>
      </section>
            {accountRemovalConfirmation && <style>{`
        .kh-account-removal-confirm-popout {
          z-index: 1002; width: min(320px, calc(100vw - 48px)); padding: 14px;
          box-sizing: border-box; white-space: normal; overflow-wrap: anywhere;
          border: 1px solid rgba(255,255,255,.14); border-radius: 16px;
          background: linear-gradient(145deg, rgba(30,35,49,.99), rgba(15,19,30,.99));
          box-shadow: 0 14px 38px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.05);
          animation: kh-account-removal-pop-in .14s ease-out;
        }
        .kh-account-removal-confirm-popout > strong { display: block; font-size: 14px; line-height: 1.35; font-weight: 650; }
        .kh-account-removal-confirm-popout > p { margin: 8px 0 13px; color: rgba(235,239,249,.78); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; white-space: normal; }
        .kh-account-removal-email { color: #fff; font-weight: 650; }
        .kh-account-removal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .kh-account-removal-actions button { min-width: 0; min-height: 36px; padding: 7px 9px; border-radius: 10px; font-size: 12px; font-weight: 600; }
        .kh-account-removal-actions button.is-danger { border: 1px solid rgba(255,107,107,.35); color: #fff; background: linear-gradient(135deg,#e34f5f,#b92e43); }
        .kh-account-removal-actions button:disabled { opacity: .58; cursor: wait; }
        @keyframes kh-account-removal-pop-in { from { opacity: 0; transform: translateY(-3px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) { .kh-account-removal-confirm-popout { animation: none; } }
      `}</style>}
      <AccountVerification />
      <p className="kh-identity-footnote">Never share your password or verification codes.</p>
  </div>;
}

function SecurityIcon() {
  const path = 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3';
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} /></svg>;
}
