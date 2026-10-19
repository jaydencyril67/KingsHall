import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import Toast from './Toast';
import LoadingDots from './components/LoadingDots';
import AccountVerification from './AccountVerification';

type Wallet = { id: string; label: string; network: string; address: string };
type Profile = {
  securityCodeChangedAt?: string | null; fundingCodeChangedAt?: string | null; accessCodeChangedAt?: string | null;
  id?: string; kui?: string; firstName?: string; middleName?: string; lastName?: string; username?: string; email?: string;
  dateOfBirth?: string; phone?: string; country?: string; state?: string; city?: string; address?: string;
  postalCode?: string; nationality?: string; gender?: string; occupation?: string; bio?: string; avatarData?: string; coverPhoto?: string;
  website?: string; instagram?: string; facebook?: string; xHandle?: string; telegram?: string; discord?: string;
  linkedin?: string; language?: string; timeZone?: string; preferredCurrency?: string; pronouns?: string;
  relationshipStatus?: string; wallets?: Wallet[]; securityCodeSet?: boolean; fundingCodeSet?: boolean; accessCodeSet?: boolean;
};
type Props = { user: { id: string; name: string; username: string; email: string; isEmailVerified: boolean } | null };
type ResponseData = { profile?: Profile; message?: string; error?: string; fundingCodeSet?: boolean; securityCodeSet?: boolean; accessCodeSet?: boolean; enabled?: boolean; pending?: boolean; secret?: string };
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
const NETWORKS = ['TRC20', 'TRX', 'BRC20', 'ERC20', 'BEP20', 'BTC', 'SOL', 'TON', 'POLYGON', 'OTHER'];
function newWallet(): Wallet { return { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), label: '', network: 'TRC20', address: '' }; }
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

function validateWalletAddress(network: string, address: string): { valid: boolean; message: string } {
  const value = address.trim();
  if (!value) return { valid: false, message: '' };
  const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
  const evm = /^0x[a-fA-F0-9]{40}$/;
  let valid = false;
  switch (network) {
    case 'TRC20':
    case 'TRX':
      valid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value);
      break;
    case 'ERC20':
    case 'BEP20':
    case 'POLYGON':
      valid = evm.test(value);
      break;
    case 'BTC':
    case 'BRC20':
      valid = /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(value);
      break;
    case 'SOL':
      valid = value.length >= 32 && value.length <= 44 && base58.test(value);
      break;
    case 'TON':
      valid = /^(?:EQ|UQ)[A-Za-z0-9_-]{46}$/.test(value) || /^-?\d:[a-fA-F0-9]{64}$/.test(value);
      break;
    default:
      valid = value.length >= 10 && value.length <= 200 && !/\s/.test(value);
  }
  return valid
    ? { valid: true, message: 'Address format looks valid for ' + (network === 'BRC20' ? 'Bitcoin (BRC-20)' : network) + '.' }
    : { valid: false, message: 'This does not match the expected ' + (network === 'BRC20' ? 'Bitcoin (BRC-20)' : network) + ' address format.' };
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
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [savedBrowserAccounts, setSavedBrowserAccounts] = useState<string[]>(() => Capacitor.isNativePlatform() ? [] : readBrowserAccounts());
  const [savedAndroidAccounts, setSavedAndroidAccounts] = useState<string[]>([]);
  const [browserAccountActionMenuEmail, setBrowserAccountActionMenuEmail] = useState<string | null>(null);
  const [androidAccountActionMenuEmail, setAndroidAccountActionMenuEmail] = useState<string | null>(null);
  const [removingAndroidAccount, setRemovingAndroidAccount] = useState(false);
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
  const [securityDraft, setSecurityDraft] = useState({ password: '', kui: '', securityCode: '', accessCode: '', twoFactor: '', fundingCode: '' });
  const [loading, setLoading] = useState(true);
  const [savingWallets, setSavingWallets] = useState(false);
  const [savingSecuritySettings, setSavingSecuritySettings] = useState(false);
  const [activeSecurityField, setActiveSecurityField] = useState<'password' | 'securityCode' | 'accessCode' | 'fundingCode' | null>(null);
  const [securityFieldMenu, setSecurityFieldMenu] = useState<'password' | 'securityCode' | 'accessCode' | 'fundingCode' | null>(null);
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [walletDraft, setWalletDraft] = useState<Wallet | null>(null);
  const [walletActionMenuId, setWalletActionMenuId] = useState<string | null>(null);
  const [walletVerificationRequested, setWalletVerificationRequested] = useState(false);
  const [walletEmailVerificationCode, setWalletEmailVerificationCode] = useState('');
  const [walletPendingDeleteId, setWalletPendingDeleteId] = useState<string | null>(null);
  const [securityCodeSet, setSecurityCodeSet] = useState(false);
  const [fundingCodeSet, setFundingCodeSet] = useState(false);
  const [accessCodeSet, setAccessCodeSet] = useState(false);
  const [securityCodeChangedAt, setSecurityCodeChangedAt] = useState<string | null>(null);
  const [fundingCodeChangedAt, setFundingCodeChangedAt] = useState<string | null>(null);
  const [accessCodeChangedAt, setAccessCodeChangedAt] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorCancelBusy, setTwoFactorCancelBusy] = useState(false);
  const [twoFactorVerifyBusy, setTwoFactorVerifyBusy] = useState(false);
  const [openNetworkId, setOpenNetworkId] = useState<string | null>(null);
  const [networkSearch, setNetworkSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);

  useEffect(() => {
    const closeNetworkSelector = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.kh-wallet-network-field')) return;
      if (target instanceof Element && target.closest('.kh-security-code-input-wrap')) return;
      if (!(target instanceof Element && target.closest('.kh-wallet-address-item'))) setWalletActionMenuId(null);
      if (!(target instanceof Element && target.closest('.kh-security-browser-account'))) { setBrowserAccountActionMenuEmail(null); setAndroidAccountActionMenuEmail(null); }
      setSecurityFieldMenu(null);
      setOpenNetworkId(null);
      setNetworkSearch('');
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenNetworkId(null);
        setNetworkSearch('');
        setWalletActionMenuId(null);
        setBrowserAccountActionMenuEmail(null);
        setAndroidAccountActionMenuEmail(null);
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
    Promise.all([request('/api/identity'), request('/api/identity/2fa/status')]).then(([data, twoFactor]) => {
      if (!current) return;
      setWallets((data.profile?.wallets || []).filter(wallet => Boolean(wallet.address?.trim())));
      setKui(data.profile?.kui || '');
      setFundingCodeSet(Boolean(data.profile?.fundingCodeSet));
      setSecurityCodeSet(Boolean(data.profile?.securityCodeSet));
      setAccessCodeSet(Boolean(data.profile?.accessCodeSet));
      setSecurityCodeChangedAt(data.profile?.securityCodeChangedAt || null);
      setFundingCodeChangedAt(data.profile?.fundingCodeChangedAt || null);
      setAccessCodeChangedAt(data.profile?.accessCodeChangedAt || null);
      setTwoFactorEnabled(Boolean(twoFactor.enabled));
      setTwoFactorPending(Boolean(twoFactor.pending));
    }).catch(error => {
      if (current) { setNotice((error as Error).message || 'Could not load your security details.'); setNoticeOk(false); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user?.id]);

  function patchWallet(id: string, key: 'label' | 'network' | 'address', value: string) {
    setWalletDraft(old => old?.id === id ? { ...old, [key]: value } : old);
  }

  function walletAddressValidation(wallet: Wallet) {
    return validateWalletAddress(wallet.network, wallet.address);
  }

  const securityCodeCooldownMs = codeCooldownRemaining(securityCodeChangedAt);
  const fundingCodeCooldownMs = codeCooldownRemaining(fundingCodeChangedAt);
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
    if (field === 'fundingCode' && !/^\\d{4}$/.test(securityDraft.fundingCode)) { setNotice('Funding Code must contain exactly 4 digits.'); setNoticeOk(false); return; }
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
          ...(field === 'fundingCode' ? { fundingCode: securityDraft.fundingCode } : {}),
          ...(field === 'accessCode' ? { accessCode: securityDraft.accessCode } : {})
        };
        const result = await request('/api/identity/security-settings', payload);
        setSecurityCodeSet(Boolean(result.securityCodeSet)); setFundingCodeSet(Boolean(result.fundingCodeSet)); setAccessCodeSet(Boolean(result.accessCodeSet));
        const changedAt = new Date().toISOString();
        if (field === 'securityCode') setSecurityCodeChangedAt(changedAt);
        if (field === 'fundingCode') setFundingCodeChangedAt(changedAt);
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

  function renderSecurityVerificationPanel(field: 'password' | 'securityCode' | 'accessCode' | 'fundingCode') {
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
      setTwoFactorEnabled(false); setTwoFactorPending(false); setTwoFactorSecret(''); setTwoFactorCode('');
      setNotice(result.message || 'Authenticator unbound.'); setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Could not unbind authenticator.'); setNoticeOk(false); }
    finally { setTwoFactorBusy(false); }
  }

  async function requestWalletVerification(actionOverride?: 'add' | 'edit' | 'delete'): Promise<void> {
    if ((!walletDraft && !walletPendingDeleteId && actionOverride !== 'delete') || savingWallets || (walletVerificationRequested && actionOverride !== 'delete')) return;
    let action: 'add' | 'edit' | 'delete';
    if (actionOverride === 'delete' || walletPendingDeleteId) {
      action = 'delete';
    } else {
      if (!walletDraft) return;
      const validation = walletAddressValidation(walletDraft);
      if (!walletDraft.address.trim() || !validation.valid) {
        setNotice(!walletDraft.address.trim() ? 'Enter a wallet address before continuing.' : validation.message);
        setNoticeOk(false);
        return;
      }
      action = wallets.some(wallet => wallet.id === walletDraft.id) ? 'edit' : 'add';
    }
    setSavingWallets(true); setNotice('');
    try {
      const result = await request('/api/identity/wallets/verification/request', { action });
      setWalletVerificationRequested(true);
      setWalletEmailVerificationCode('');
      setNotice(result.message || 'Verification code sent to your verified email.');
      setNoticeOk(true);
    } catch (error) {
      setNotice((error as Error).message || 'Could not send the wallet verification code.');
      setNoticeOk(false);
    } finally { setSavingWallets(false); }
  }

  async function saveWallets(nextWallets: Wallet[] = wallets, emailVerificationCode = '', walletAction = 'delete'): Promise<boolean> {
    if (savingWallets) return false;
    const invalidWallet = nextWallets.find(wallet => !wallet.address.trim() || !validateWalletAddress(wallet.network, wallet.address).valid);
    if (invalidWallet) {
      setNotice(!invalidWallet.address.trim()
        ? 'Enter a wallet address before saving.'
        : 'Please correct the wallet address for ' + (invalidWallet.network === 'BRC20' ? 'Bitcoin (BRC-20)' : invalidWallet.network) + ' before saving.');
      setNoticeOk(false);
      return false;
    }
    setSavingWallets(true); setNotice('');
    try {
      const result = await request('/api/identity/wallets', { wallets: nextWallets, emailVerificationCode, walletAction });
      setWallets((result.profile?.wallets || nextWallets).filter(wallet => Boolean(wallet.address?.trim())));
      setNotice(result.message || 'Wallet addresses saved.');
      setNoticeOk(true);
      return true;
    } catch (error) {
      setNotice((error as Error).message || 'Could not save wallet addresses.');
      setNoticeOk(false);
      return false;
    } finally { setSavingWallets(false); }
  }

  async function commitWalletDraft(): Promise<void> {
    if ((!walletDraft && !walletPendingDeleteId) || savingWallets) return;
    if (!walletVerificationRequested) { await requestWalletVerification(); return; }
    if (!/^\d{6}$/.test(walletEmailVerificationCode)) {
      setNotice('Enter the six-digit code sent to your email.');
      setNoticeOk(false);
      return;
    }
    if (walletPendingDeleteId) {
      const nextWallets = wallets.filter(wallet => wallet.id !== walletPendingDeleteId);
      if (await saveWallets(nextWallets, walletEmailVerificationCode, 'delete')) {
        setWalletPendingDeleteId(null);
        setWalletDraft(null);
        setWalletVerificationRequested(false);
        setWalletEmailVerificationCode('');
        setWalletActionMenuId(null);
      }
      return;
    }
    if (!walletDraft) return;
    const existing = wallets.some(wallet => wallet.id === walletDraft.id);
    const nextWallets = existing
      ? wallets.map(wallet => wallet.id === walletDraft.id ? walletDraft : wallet)
      : [...wallets, walletDraft];
    const action = existing ? 'edit' : 'add';
    if (await saveWallets(nextWallets, walletEmailVerificationCode, action)) {
      setWalletDraft(null);
      setWalletActionMenuId(null);
      setWalletVerificationRequested(false);
      setWalletEmailVerificationCode('');
      setWalletPendingDeleteId(null);
    }
  }

  async function deleteWallet(walletId: string): Promise<void> {
    if (savingWallets) return;
    setWalletPendingDeleteId(walletId);
    setWalletDraft(null);
    setWalletVerificationRequested(false);
    setWalletEmailVerificationCode('');
    setWalletActionMenuId(null);
    setOpenNetworkId(null);
    setNotice('Sending a verification code to your verified email…');
    setNoticeOk(true);
    await requestWalletVerification('delete');
  }

  return <div className="kh-identity-page kh-security-page">
    <div className="kh-identity-heading">
      <span className="eyebrow"><span className="eyebrow-line" />ACCOUNT PROTECTION</span>
      <h1>KingsHall <em>Security.</em></h1>
      <p>Manage your wallet addresses and review account-protection settings from one dedicated page.</p>
    </div>
    <Toast message={notice} tone={noticeOk ? 'success' : 'error'} onClose={() => setNotice('')} />

      {Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' ? <section className="kh-identity-card kh-security-browser-accounts">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon type="lock" /></span><div><h2>Saved Android accounts</h2><p>Manage KingsHall accounts saved in Android Account Manager on this device. Removing one deletes its saved device account and refresh credential; it does not log out your current in-app session.</p></div></div>
        {savedAndroidAccounts.length > 0 ? <div className="kh-security-browser-account-list">
          {savedAndroidAccounts.map(email => <div className="kh-security-browser-account" key={email}>
            <button type="button" className="kh-security-browser-account-trigger" aria-expanded={androidAccountActionMenuEmail === email} onClick={() => setAndroidAccountActionMenuEmail(current => current === email ? null : email)}>
              <span className="kh-security-browser-account-email">{email}</span><span className="kh-security-browser-account-chevron" aria-hidden="true">⌄</span>
            </button>
            {androidAccountActionMenuEmail === email && <div className="kh-wallet-actions-popout kh-security-browser-account-popout" role="group" aria-label="Saved Android account actions">
              <button type="button" className="is-danger" disabled={removingAndroidAccount} onClick={async event => {
                event.stopPropagation();
                if (!window.confirm('Remove ' + email + ' from Android saved KingsHall accounts on this device? This will delete its saved device credential.')) return;
                setRemovingAndroidAccount(true); setNotice('');
                try {
                  await AndroidAccounts.removeAccount({ email });
                  setSavedAndroidAccounts(current => current.filter(item => item !== email));
                  setAndroidAccountActionMenuEmail(null);
                  setNotice('KingsHall account removed from Android Account Manager.'); setNoticeOk(true);
                } catch (error) {
                  setNotice((error as Error).message || 'Could not remove the saved Android account.'); setNoticeOk(false);
                } finally { setRemovingAndroidAccount(false); }
              }}>{removingAndroidAccount ? 'Removing…' : 'Remove account'}</button>
            </div>}
          </div>)}
        </div> : <p className="kh-security-browser-accounts-empty">No KingsHall accounts are currently saved in Android Account Manager.</p>}
      </section> : !Capacitor.isNativePlatform() && <section className="kh-identity-card kh-security-browser-accounts">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon type="lock" /></span><div><h2>Saved browser accounts</h2><p>Manage accounts saved on this browser. You can remove an account here; sign-in and account selection happen in the connected app.</p></div></div>
        {savedBrowserAccounts.length > 0 ? <div className="kh-security-browser-account-list">
          {savedBrowserAccounts.map(email => <div className="kh-security-browser-account" key={email}>
            <button type="button" className="kh-security-browser-account-trigger" aria-expanded={browserAccountActionMenuEmail === email} onClick={() => setBrowserAccountActionMenuEmail(current => current === email ? null : email)}>
              <span className="kh-security-browser-account-email">{email}</span><span className="kh-security-browser-account-chevron" aria-hidden="true">⌄</span>
            </button>
            {browserAccountActionMenuEmail === email && <div className="kh-wallet-actions-popout kh-security-browser-account-popout" role="group" aria-label="Saved account actions">
              <button type="button" className="is-danger" onClick={event => {
                event.stopPropagation();
                const removed = [...new Set([...readCookieList(REMOVED_ACCOUNTS_KEY), email])].slice(-50);
                writeCookieList(REMOVED_ACCOUNTS_KEY, removed);
                const remaining = writeBrowserAccounts(savedBrowserAccounts.filter(item => item !== email));
                setSavedBrowserAccounts(remaining); setBrowserAccountActionMenuEmail(null);
                let currentHint = '';
                const hintCookie = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith('kh_account_hint='));
                if (hintCookie) { try { currentHint = decodeURIComponent(hintCookie.slice('kh_account_hint='.length)).trim().toLowerCase(); } catch {} }
                if (currentHint === email) {
                  document.cookie = 'kh_account_hint=; Domain=.kingshall.online; Path=/; Max-Age=0; Secure; SameSite=Lax';
                  localStorage.removeItem('kingshall_account_hint');
                }
                setNotice('Saved account removed from this browser.'); setNoticeOk(true);
              }}>Remove</button>
            </div>}
          </div>)}
        </div> : <p className="kh-security-browser-accounts-empty">No saved browser accounts yet. Sign in to KingsHall on this browser to add one.</p>}
      </section>}

      <section className="kh-identity-card kh-identity-security">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon type="lock" /></span><div><h2>Account security{loading && <span className="kh-identity-section-loading" aria-label="Loading security details"><LoadingDots /></span>}</h2><p>Manage your account security settings below.</p></div></div>
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
          <div className="field kh-security-editable-field">
            <label htmlFor="security-funding-code">4-digit Funding Code</label>
            <div className="kh-security-code-input-wrap">
              <input id="security-funding-code" readOnly={activeSecurityField !== 'fundingCode'} disabled={fundingCodeSet && fundingCodeCooldownMs > 0} onClick={() => { if (fundingCodeCooldownMs <= 0 && activeSecurityField !== 'fundingCode') setSecurityFieldMenu('fundingCode'); }} type={activeSecurityField === 'fundingCode' ? 'password' : 'text'} inputMode="numeric" autoComplete="new-password" maxLength={4} placeholder={activeSecurityField === 'fundingCode' ? 'Enter a new 4-digit code' : fundingCodeSet ? '••••' : 'Not set'} value={activeSecurityField === 'fundingCode' ? securityDraft.fundingCode : (fundingCodeSet ? '••••' : '')} onChange={e => setSecurityDraft(old => ({ ...old, fundingCode: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
              {fundingCodeSet && <span className="kh-security-code-check" aria-label="Code saved"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}
              {securityFieldMenu === 'fundingCode' && fundingCodeCooldownMs <= 0 && <button type="button" className="kh-security-edit-trigger kh-security-edit-popout" onClick={event => { event.stopPropagation(); setSecurityFieldMenu(null); setActiveSecurityField('fundingCode'); setSecurityDraft(old => ({ ...old, fundingCode: '' })); setVerificationRequested(false); setEmailVerificationCode(''); setNotice(''); }}>✎ Edit</button>}
            </div>
            {renderSecurityVerificationPanel('fundingCode')}
            {fundingCodeCooldownMs > 0 && <small className="kh-code-cooldown-note">Change available in {formatCodeCooldown(fundingCodeCooldownMs)}.</small>}
          </div>
        </div>

      </section>

      <section className="kh-identity-card kh-identity-security">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon type="lock" /></span><div><h2>Two-factor authenticator</h2><p>Bind an authenticator app. Sign-in enforcement remains off for now.</p></div></div>
        <div className="kh-identity-grid kh-identity-security-fields">
          <div className="field kh-two-factor-status-field"><label>Binding status</label><div className="kh-two-factor-status" role="status"><span>{twoFactorEnabled ? 'Bound and verified' : twoFactorPending ? 'Setup pending verification' : 'Not bound'}</span>{twoFactorEnabled && <span className="kh-security-code-check kh-two-factor-status-check" aria-label="Bound and verified"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}</div></div>
          {!twoFactorEnabled && !twoFactorSecret && <div className="field"><label>Authenticator setup</label><button type="button" className="submit-button" disabled={twoFactorBusy} onClick={() => void startAuthenticator()}>{twoFactorBusy ? <LoadingDots /> : twoFactorPending ? 'Restart Setup' : 'Bind Authenticator'}</button></div>}
          {twoFactorSecret && <div className="field"><label htmlFor="kh-two-factor-secret">Setup key</label><div className="kh-two-factor-secret-row"><input id="kh-two-factor-secret" value={twoFactorSecret} readOnly /><button type="button" className="kh-copy-secret-button" aria-label="Copy authenticator setup key" title="Copy setup key" onClick={() => void copyAuthenticatorSecret()}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg></button></div><small className="kh-postal-feedback">In your authenticator app, choose Enter a setup key. Account: {user?.email || 'KingsHall'}. Keep this key private.</small></div>}
          {(twoFactorSecret || twoFactorEnabled) && <div className="field"><label htmlFor="kh-two-factor-code">{twoFactorEnabled ? 'Current code to unbind' : 'Verify authenticator code'}</label><input id="kh-two-factor-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />{twoFactorEnabled ? <button type="button" className="submit-button" disabled={twoFactorBusy || twoFactorCode.length !== 6} onClick={() => void removeAuthenticator()}>{twoFactorBusy ? <LoadingDots /> : 'Unbind Authenticator'}</button> : <div className="kh-two-factor-verify-actions"><button type="button" className="secondary-button kh-two-factor-cancel-button" disabled={twoFactorCancelBusy || twoFactorVerifyBusy || twoFactorBusy} onClick={() => void cancelAuthenticatorSetup()}>{twoFactorCancelBusy ? <LoadingDots /> : 'Cancel'}</button><button type="button" className="submit-button kh-two-factor-verify-button" disabled={twoFactorCancelBusy || twoFactorVerifyBusy || twoFactorBusy || twoFactorCode.length !== 6} onClick={() => void verifyAuthenticator()}>{twoFactorVerifyBusy ? <LoadingDots /> : 'Verify & Bind'}</button></div>}</div>}
          
        </div>
      </section>
            <section className="kh-identity-card kh-security-wallet-card">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon type="wallet" /></span><div><h2>Wallets</h2><p>Manage your public receiving addresses. Never enter a seed phrase or private key.</p></div></div>
        <div className="kh-identity-wallets">
          {wallets.filter(wallet => wallet.address.trim()).map(wallet => <div className="kh-wallet-address-item" key={wallet.id}>
            <button type="button" className="kh-wallet-address-trigger" aria-label={'Wallet address on ' + (wallet.network === 'BRC20' ? 'BRC-20 (Bitcoin)' : wallet.network) + ': ' + wallet.address} aria-expanded={walletActionMenuId === wallet.id} onClick={() => setWalletActionMenuId(current => current === wallet.id ? null : wallet.id)}>
              <span className="kh-wallet-address-copy"><small>{wallet.label.trim() || (wallet.network === 'BRC20' ? 'BRC-20 (Bitcoin)' : wallet.network)}</small><strong>{wallet.address}</strong></span>
              <span className="kh-wallet-address-network">{wallet.network === 'BRC20' ? 'BRC-20' : wallet.network}</span>
            </button>
            {walletActionMenuId === wallet.id && <div className="kh-wallet-actions-popout" role="group" aria-label="Wallet address actions">
              <button type="button" onClick={() => { setWalletDraft({ ...wallet }); setWalletPendingDeleteId(null); setWalletVerificationRequested(false); setWalletEmailVerificationCode(''); setWalletActionMenuId(null); setNotice(''); }}>Edit</button>
              <button type="button" className="is-danger" onClick={() => void deleteWallet(wallet.id)}>Delete</button>
            </div>}
          </div>)}
        </div>
        {walletDraft && <div className="kh-wallet-editor">
          <div className="kh-wallet-editor-heading"><strong>{wallets.some(wallet => wallet.id === walletDraft.id) ? 'Edit wallet address' : 'Add wallet address'}</strong><button type="button" className="kh-wallet-cancel-edit" disabled={savingWallets} onClick={() => { setWalletDraft(null); setWalletPendingDeleteId(null); setOpenNetworkId(null); setWalletVerificationRequested(false); setWalletEmailVerificationCode(''); setNotice(''); }}>Cancel</button></div>
          <div className="kh-identity-grid">
            <div className="field"><label htmlFor="security-wallet-label">Label <span className="optional">(optional)</span></label><input id="security-wallet-label" maxLength={40} placeholder="e.g. Main USDT wallet" value={walletDraft.label} onChange={e => patchWallet(walletDraft.id, 'label', e.target.value)} /></div>
            <div className={`field kh-nationality-field kh-wallet-network-field${openNetworkId === walletDraft.id ? ' is-open' : ''}`}><label id="security-wallet-network-label">Network</label><button className="kh-nationality-trigger" type="button" aria-labelledby="security-wallet-network-label" aria-haspopup="listbox" aria-expanded={openNetworkId === walletDraft.id} onClick={() => { setOpenNetworkId(current => current === walletDraft.id ? null : walletDraft.id); setNetworkSearch(''); }}><span>{walletDraft.network === 'BRC20' ? 'BRC-20 (Bitcoin)' : walletDraft.network}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></button>{openNetworkId === walletDraft.id && <div className="kh-nationality-popout"><input className="kh-nationality-search" type="search" aria-label="Search wallet networks" placeholder="Search networks…" autoComplete="off" value={networkSearch} onChange={e => setNetworkSearch(e.target.value)} /><div className="kh-nationality-list" role="listbox" aria-label="Wallet networks">{NETWORKS.filter(network => (network === 'BRC20' ? 'BRC-20 (Bitcoin)' : network).toLowerCase().includes(networkSearch.trim().toLowerCase())).map(network => <button type="button" role="option" aria-selected={walletDraft.network === network} className="kh-nationality-option" key={network} onClick={() => { patchWallet(walletDraft.id, 'network', network); setOpenNetworkId(null); setNetworkSearch(''); }}>{network === 'BRC20' ? 'BRC-20 (Bitcoin)' : network}{walletDraft.network === network && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg>}</button>)}{NETWORKS.filter(network => (network === 'BRC20' ? 'BRC-20 (Bitcoin)' : network).toLowerCase().includes(networkSearch.trim().toLowerCase())).length === 0 && <p className="kh-nationality-empty">No matching network found.</p>}</div></div>}</div>
            <div className="field kh-identity-span"><label htmlFor="security-wallet-address">Wallet address</label><input id="security-wallet-address" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200} placeholder="Paste public wallet address" value={walletDraft.address} aria-invalid={Boolean(walletDraft.address.trim() && !walletAddressValidation(walletDraft).valid)} onChange={e => patchWallet(walletDraft.id, 'address', e.target.value)} />{walletDraft.address.trim() && <small className={walletAddressValidation(walletDraft).valid ? 'kh-wallet-address-feedback is-valid' : 'kh-wallet-address-feedback is-invalid'} role="status">{walletAddressValidation(walletDraft).message}</small>}</div>
          </div>
        </div>}
        {(walletDraft || walletPendingDeleteId) && walletVerificationRequested ? <div className="kh-wallet-verify-row"><input className="kh-wallet-verification-code" aria-label="Email verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Email code" value={walletEmailVerificationCode} onChange={e => setWalletEmailVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /><button className="secondary-button kh-identity-add-wallet kh-wallet-smart-button kh-wallet-verify-action" type="button" disabled={savingWallets || walletEmailVerificationCode.length !== 6} onClick={() => void commitWalletDraft()}>{savingWallets ? <LoadingDots /> : walletPendingDeleteId ? 'Verify & delete' : 'Verify & save'}</button></div> : <button className="secondary-button kh-identity-add-wallet kh-wallet-smart-button" type="button" disabled={savingWallets || (!walletDraft && !walletPendingDeleteId && wallets.length >= 20)} onClick={() => { if (walletDraft || walletPendingDeleteId) void commitWalletDraft(); else { setWalletDraft(newWallet()); setWalletPendingDeleteId(null); setWalletVerificationRequested(false); setWalletEmailVerificationCode(''); setWalletActionMenuId(null); setNotice(''); } }}>{savingWallets ? <LoadingDots /> : walletDraft || walletPendingDeleteId ? 'Send code' : '+ Add wallet address'}</button>}
      </section>
      <AccountVerification />
      <p className="kh-identity-footnote">Never share your password or verification codes. Only enter public wallet receiving addresses here.</p>
  </div>;
}

function SecurityIcon({ type }: { type: 'wallet' | 'lock' }) {
  const path = type === 'wallet' ? 'M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12 M16 12h5' : 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3';
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} /></svg>;
}
