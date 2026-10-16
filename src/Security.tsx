import { useEffect, useState } from 'react';
import Toast from './Toast';
import LoadingDots from './components/LoadingDots';

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
const NETWORKS = ['TRC20', 'TRX', 'BRC20', 'ERC20', 'BEP20', 'BTC', 'SOL', 'TON', 'POLYGON', 'OTHER'];
function newWallet(): Wallet { return { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), label: '', network: 'TRC20', address: '' }; }
function codeCooldownRemaining(changedAt: string | null | undefined): number {
  if (!changedAt) return 0;
  const changedTime = new Date(changedAt).getTime();
  return Number.isFinite(changedTime) ? Math.max(0, changedTime + 30 * 24 * 60 * 60 * 1000 - Date.now()) : 0;
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
  const [kui, setKui] = useState('');
  const [securityDraft, setSecurityDraft] = useState({ password: '', kui: '', securityCode: '', accessCode: '', twoFactor: '', fundingCode: '' });
  const [loading, setLoading] = useState(true);
  const [savingWallets, setSavingWallets] = useState(false);
  const [savingSecuritySettings, setSavingSecuritySettings] = useState(false);
  const [activeSecurityField, setActiveSecurityField] = useState<'password' | 'securityCode' | 'accessCode' | 'fundingCode' | null>(null);
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [walletsEditing, setWalletsEditing] = useState(false);
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
  const [openNetworkId, setOpenNetworkId] = useState<string | null>(null);
  const [networkSearch, setNetworkSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);

  useEffect(() => {
    const closeNetworkSelector = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.kh-wallet-network-field')) return;
      setOpenNetworkId(null);
      setNetworkSearch('');
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenNetworkId(null);
        setNetworkSearch('');
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
      setWallets(data.profile?.wallets || []);
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
    setWallets(old => old.map(wallet => wallet.id === id ? { ...wallet, [key]: value } : wallet));
  }

  function walletAddressValidation(wallet: Wallet) {
    return validateWalletAddress(wallet.network, wallet.address);
  }

  const securityCodeCooldownMs = codeCooldownRemaining(securityCodeChangedAt);
  const fundingCodeCooldownMs = codeCooldownRemaining(fundingCodeChangedAt);
  const accessCodeCooldownMs = codeCooldownRemaining(accessCodeChangedAt);

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
    if (!/^\\d{6}$/.test(emailVerificationCode)) { setNotice('Enter the six-digit code sent to your email.'); setNoticeOk(false); return; }
    const field = activeSecurityField;
    if (field === 'password' && !passwordValid) { setNotice('Password must be 12–128 characters and include uppercase, lowercase, a number and a symbol.'); setNoticeOk(false); return; }
    if (field === 'securityCode' && !/^\\d{8}$/.test(securityDraft.securityCode)) { setNotice('Security Code must contain exactly 8 digits.'); setNoticeOk(false); return; }
    if (field === 'fundingCode' && !/^\\d{4}$/.test(securityDraft.fundingCode)) { setNotice('Funding Code must contain exactly 4 digits.'); setNoticeOk(false); return; }
    if (field === 'accessCode' && !/^\\d{6}$/.test(securityDraft.accessCode)) { setNotice('Access Code must contain exactly 6 digits.'); setNoticeOk(false); return; }
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
      setActiveSecurityField(null); setEmailVerificationCode(''); setVerificationRequested(false) setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Could not save this security setting.'); setNoticeOk(false); }
    finally { setSavingSecuritySettings(false); }
  }

  function cancelSecurityEdit() {
    if (activeSecurityField) setSecurityDraft(old => ({ ...old, [activeSecurityField]: '' }));
    setActiveSecurityField(null); setEmailVerificationCode(''); setVerificationRequested(false)
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
    if (!/^\d{6}$/.test(twoFactorCode)) { setNotice('Enter the six-digit authenticator code.'); setNoticeOk(false); return; }
    setTwoFactorBusy(true);
    try {
      const result = await request('/api/identity/2fa/verify', { code: twoFactorCode });
      setTwoFactorEnabled(true); setTwoFactorPending(false); setTwoFactorSecret(''); setTwoFactorCode('');
      setNotice(result.message || 'Authenticator bound successfully.'); setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Code verification failed.'); setNoticeOk(false); }
    finally { setTwoFactorBusy(false); }
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

  async function saveWallets(): Promise<boolean> {
    if (savingWallets) return false;
    const invalidWallet = wallets.find(wallet => wallet.address.trim() && !validateWalletAddress(wallet.network, wallet.address).valid);
    if (invalidWallet) {
      setNotice('Please correct the wallet address for ' + (invalidWallet.network === 'BRC20' ? 'Bitcoin (BRC-20)' : invalidWallet.network) + ' before saving.');
      setNoticeOk(false);
      return false;
    }
    setSavingWallets(true); setNotice('');
    try {
      // Preserve the latest saved profile fields; this action changes wallet data only.
      const latest = await request('/api/identity');
      const saved = latest.profile || {};
      const payload = {
        firstName: saved.firstName || '', middleName: saved.middleName || '', lastName: saved.lastName || '',
        username: saved.username || user?.username || '', email: saved.email || user?.email || '',
        dateOfBirth: saved.dateOfBirth || '', phone: saved.phone || '', country: saved.country || '',
        state: saved.state || '', city: saved.city || '', address: saved.address || '', postalCode: saved.postalCode || '',
        nationality: saved.nationality || '', gender: saved.gender || '', occupation: saved.occupation || '',
        bio: saved.bio || '', avatarData: saved.avatarData || '', coverPhoto: saved.coverPhoto || '', website: saved.website || '',
        instagram: saved.instagram || '', facebook: saved.facebook || '', xHandle: saved.xHandle || '',
        telegram: saved.telegram || '', discord: saved.discord || '', linkedin: saved.linkedin || '',
        language: saved.language || '', timeZone: saved.timeZone || '', preferredCurrency: saved.preferredCurrency || 'USD',
        pronouns: saved.pronouns || '', relationshipStatus: saved.relationshipStatus || '', wallets
      };
      const result = await request('/api/identity', payload);
      setWallets(result.profile?.wallets || wallets);
      setNotice(result.message || 'Wallet addresses saved.');
      setNoticeOk(true);
      return true;
    } catch (error) {
      setNotice((error as Error).message || 'Could not save wallet addresses.');
      setNoticeOk(false);
      return false;
    } finally { setSavingWallets(false); }
  }

  return <div className="kh-identity-page kh-security-page">
    <div className="kh-identity-heading">
      <span className="eyebrow"><span className="eyebrow-line" />ACCOUNT PROTECTION</span>
      <h1>KingsHall <em>Security.</em></h1>
      <p>Manage your wallet addresses and review account-protection settings from one dedicated page.</p>
    </div>
    <Toast message={notice} tone={noticeOk ? 'success' : 'error'} onClose={() => setNotice('')} />

      <section className="kh-identity-card kh-identity-security">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon type="lock" /></span><div><h2>Account security{loading && <span className="kh-identity-section-loading" aria-label="Loading security details"><LoadingDots /></span>}</h2><p>Manage your account security settings below.</p></div></div>
        <div className="kh-identity-grid kh-identity-security-fields">
          <div className="field kh-security-editable-field">
            <label htmlFor="security-password">Password</label>
            <div className="kh-security-code-input-wrap"><input id="security-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder={activeSecurityField === 'password' ? 'Enter a new password' : '••••••••••••'} disabled={activeSecurityField !== 'password'} value={securityDraft.password} onChange={e => setSecurityDraft(old => ({ ...old, password: e.target.value }))} />{activeSecurityField === 'password' && passwordValid && <span className="kh-security-code-check" aria-label="Password meets requirements"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}</div>
            {activeSecurityField === 'password' ? <small className="kh-postal-feedback">12–128 characters, with uppercase, lowercase, a number and a symbol.</small> : <button type="button" className="kh-security-edit-trigger" onClick={() => { setActiveSecurityField('password'); setVerificationRequested(false); setEmailVerificationCode(''); setNotice(''); }}>✎ Edit</button>}
          </div>
          <div className="field kh-security-kui-field"><label htmlFor="security-kui">KUI (6-digit KingsHall Unique ID)</label><input id="security-kui" inputMode="numeric" autoComplete="off" maxLength={6} value={kui} readOnly disabled aria-disabled="true" /></div>
          <div className="field kh-security-editable-field">
            <label htmlFor="security-code">8-digit Security Code</label>
            <div className="kh-security-code-input-wrap"><input id="security-code" disabled={activeSecurityField !== 'securityCode' || (securityCodeSet && securityCodeCooldownMs > 0)} type={activeSecurityField === 'securityCode' ? 'password' : 'text'} inputMode="numeric" autoComplete="new-password" maxLength={8} placeholder={activeSecurityField === 'securityCode' ? 'Enter a new 8-digit code' : securityCodeSet ? '••••••••' : 'Not set'} value={activeSecurityField === 'securityCode' ? securityDraft.securityCode : (securityCodeSet ? '••••••••' : '')} onChange={e => setSecurityDraft(old => ({ ...old, securityCode: e.target.value.replace(/\D/g, '').slice(0, 8) }))} />{securityCodeSet && <span className="kh-security-code-check" aria-label="Code saved"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}</div>
            {securityCodeCooldownMs > 0 ? <small className="kh-code-cooldown-note">Change available in {formatCodeCooldown(securityCodeCooldownMs)}.</small> : activeSecurityField === 'securityCode' ? null : <button type="button" className="kh-security-edit-trigger" onClick={() => { setActiveSecurityField('securityCode'); setSecurityDraft(old => ({ ...old, securityCode: '' })); setVerificationRequested(false); setEmailVerificationCode(''); setNotice(''); }}>✎ Edit</button>}
          </div>
          <div className="field kh-security-editable-field">
            <label htmlFor="security-access-code">6-digit Access Code</label>
            <div className="kh-security-code-input-wrap"><input id="security-access-code" disabled={activeSecurityField !== 'accessCode' || (accessCodeSet && accessCodeCooldownMs > 0)} type={activeSecurityField === 'accessCode' ? 'password' : 'text'} inputMode="numeric" autoComplete="new-password" maxLength={6} placeholder={activeSecurityField === 'accessCode' ? 'Enter a new 6-digit code' : accessCodeSet ? '••••••' : 'Not set'} value={activeSecurityField === 'accessCode' ? securityDraft.accessCode : (accessCodeSet ? '••••••' : '')} onChange={e => setSecurityDraft(old => ({ ...old, accessCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />{accessCodeSet && <span className="kh-security-code-check" aria-label="Code saved"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}</div>
            {accessCodeCooldownMs > 0 ? <small className="kh-code-cooldown-note">Change available in {formatCodeCooldown(accessCodeCooldownMs)}.</small> : activeSecurityField === 'accessCode' ? null : <button type="button" className="kh-security-edit-trigger" onClick={() => { setActiveSecurityField('accessCode'); setSecurityDraft(old => ({ ...old, accessCode: '' })); setVerificationRequested(false); setEmailVerificationCode(''); setNotice(''); }}>✎ Edit</button>}
          </div>
          <div className="field kh-security-editable-field">
            <label htmlFor="security-funding-code">4-digit Funding Code</label>
            <div className="kh-security-code-input-wrap"><input id="security-funding-code" disabled={activeSecurityField !== 'fundingCode' || (fundingCodeSet && fundingCodeCooldownMs > 0)} type={activeSecurityField === 'fundingCode' ? 'password' : 'text'} inputMode="numeric" autoComplete="new-password" maxLength={4} placeholder={activeSecurityField === 'fundingCode' ? 'Enter a new 4-digit code' : fundingCodeSet ? '••••' : 'Not set'} value={activeSecurityField === 'fundingCode' ? securityDraft.fundingCode : (fundingCodeSet ? '••••' : '')} onChange={e => setSecurityDraft(old => ({ ...old, fundingCode: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />{fundingCodeSet && <span className="kh-security-code-check" aria-label="Code saved"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}</div>
            {fundingCodeCooldownMs > 0 ? <small className="kh-code-cooldown-note">Change available in {formatCodeCooldown(fundingCodeCooldownMs)}.</small> : activeSecurityField === 'fundingCode' ? null : <button type="button" className="kh-security-edit-trigger" onClick={() => { setActiveSecurityField('fundingCode'); setSecurityDraft(old => ({ ...old, fundingCode: '' })); setVerificationRequested(false); setEmailVerificationCode(''); setNotice(''); }}>✎ Edit</button>}
          </div>
        </div>
        {activeSecurityField && <div className="kh-security-verification-panel">
          {!verificationRequested ? <button type="button" className="submit-button" disabled={savingSecuritySettings} onClick={() => void requestSecurityVerification()}>{savingSecuritySettings ? <LoadingDots /> : 'Send email verification code'}</button> : <><div className="field"><label htmlFor="security-email-verification-code">Email verification code</label><input id="security-email-verification-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter the 6-digit code" value={emailVerificationCode} onChange={e => setEmailVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /><small className="kh-postal-feedback">Check your verified KingsHall email. The code expires in 10 minutes.</small></div><button type="button" className="submit-button" disabled={savingSecuritySettings || emailVerificationCode.length !== 6} onClick={() => void saveActiveSecurityField()}>{savingSecuritySettings ? <LoadingDots /> : 'Verify & Save'}</button></>}
          <button type="button" className="secondary-button" onClick={cancelSecurityEdit}>Cancel</button>
        </div>}
      </section>

      <section className="kh-identity-card kh-identity-security">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon type="lock" /></span><div><h2>Two-factor authenticator</h2><p>Bind an authenticator app. Sign-in enforcement remains off for now.</p></div></div>
        <div className="kh-identity-grid kh-identity-security-fields">
          <div className="field kh-two-factor-status-field"><label>Binding status</label><div className="kh-two-factor-status" role="status"><span>{twoFactorEnabled ? 'Bound and verified' : twoFactorPending ? 'Setup pending verification' : 'Not bound'}</span>{twoFactorEnabled && <span className="kh-security-code-check kh-two-factor-status-check" aria-label="Bound and verified"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg></span>}</div></div>
          {!twoFactorEnabled && !twoFactorSecret && <div className="field"><label>Authenticator setup</label><button type="button" className="submit-button" disabled={twoFactorBusy} onClick={() => void startAuthenticator()}>{twoFactorBusy ? <LoadingDots /> : 'Bind Authenticator'}</button></div>}
          {twoFactorSecret && <div className="field"><label htmlFor="kh-two-factor-secret">Setup key</label><div className="kh-two-factor-secret-row"><input id="kh-two-factor-secret" value={twoFactorSecret} readOnly /><button type="button" className="kh-copy-secret-button" aria-label="Copy authenticator setup key" title="Copy setup key" onClick={() => void copyAuthenticatorSecret()}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg></button></div><small className="kh-postal-feedback">In your authenticator app, choose Enter a setup key. Account: {user?.email || 'KingsHall'}. Keep this key private.</small></div>}
          {(twoFactorSecret || twoFactorEnabled) && <div className="field"><label htmlFor="kh-two-factor-code">{twoFactorEnabled ? 'Current code to unbind' : 'Verify authenticator code'}</label><input id="kh-two-factor-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /><button type="button" className="submit-button" disabled={twoFactorBusy || twoFactorCode.length !== 6} onClick={() => void (twoFactorEnabled ? removeAuthenticator() : verifyAuthenticator())}>{twoFactorBusy ? <LoadingDots /> : twoFactorEnabled ? 'Unbind Authenticator' : 'Verify & Bind'}</button></div>}
          {twoFactorPending && !twoFactorSecret && <div className="field"><small className="kh-postal-feedback">The setup key is no longer shown. Restart setup to generate a new key.</small><button type="button" className="submit-button" disabled={twoFactorBusy} onClick={() => void startAuthenticator()}>Restart Setup</button></div>}
        </div>
      </section>
      <section className="kh-identity-card">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon type="wallet" /></span><div><h2>Wallets</h2><p>Save public receiving addresses by network. Never enter a seed phrase or private key.</p></div></div>
        <fieldset className="kh-identity-editable-fields kh-security-wallet-editable-fields" disabled={!walletsEditing}>
        <div className="kh-identity-wallets">
          {wallets.map((wallet, index) => <div className="kh-identity-wallet" key={wallet.id}>
            <div className="kh-identity-wallet-title"><strong>Wallet {index + 1}</strong><button type="button" onClick={() => setWallets(old => old.filter(item => item.id !== wallet.id))}>Remove</button></div>
            <div className="kh-identity-grid">
              <div className="field"><label htmlFor={'security-wallet-label-' + wallet.id}>Label <span className="optional">(optional)</span></label><input id={'security-wallet-label-' + wallet.id} maxLength={40} placeholder="e.g. Main USDT wallet" value={wallet.label} onChange={e => patchWallet(wallet.id, 'label', e.target.value)} /></div>
              <div className={`field kh-nationality-field kh-wallet-network-field${openNetworkId === wallet.id ? ' is-open' : ''}`}><label id={'security-wallet-network-label-' + wallet.id}>Network</label><button className="kh-nationality-trigger" type="button" aria-labelledby={'security-wallet-network-label-' + wallet.id} aria-haspopup="listbox" aria-expanded={openNetworkId === wallet.id} onClick={() => { setOpenNetworkId(current => current === wallet.id ? null : wallet.id); setNetworkSearch(''); }}><span>{wallet.network === 'BRC20' ? 'BRC-20 (Bitcoin)' : wallet.network}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></button>{openNetworkId === wallet.id && <div className="kh-nationality-popout"><input className="kh-nationality-search" type="search" aria-label="Search wallet networks" placeholder="Search networks…" autoComplete="off" value={networkSearch} onChange={e => setNetworkSearch(e.target.value)} /><div className="kh-nationality-list" role="listbox" aria-label="Wallet networks">{NETWORKS.filter(network => (network === 'BRC20' ? 'BRC-20 (Bitcoin)' : network).toLowerCase().includes(networkSearch.trim().toLowerCase())).map(network => <button type="button" role="option" aria-selected={wallet.network === network} className="kh-nationality-option" key={network} onClick={() => { patchWallet(wallet.id, 'network', network); setOpenNetworkId(null); setNetworkSearch(''); }}>{network === 'BRC20' ? 'BRC-20 (Bitcoin)' : network}{wallet.network === network && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg>}</button>)}{NETWORKS.filter(network => (network === 'BRC20' ? 'BRC-20 (Bitcoin)' : network).toLowerCase().includes(networkSearch.trim().toLowerCase())).length === 0 && <p className="kh-nationality-empty">No matching network found.</p>}</div></div>}</div>
              <div className="field kh-identity-span"><label htmlFor={'security-wallet-address-' + wallet.id}>Wallet address</label><input id={'security-wallet-address-' + wallet.id} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200} placeholder="Paste public wallet address" value={wallet.address} aria-invalid={Boolean(wallet.address.trim() && !walletAddressValidation(wallet).valid)} onChange={e => patchWallet(wallet.id, 'address', e.target.value)} />{wallet.address.trim() && <small className={walletAddressValidation(wallet).valid ? 'kh-wallet-address-feedback is-valid' : 'kh-wallet-address-feedback is-invalid'} role="status">{walletAddressValidation(wallet).message}</small>}</div>
            </div>
          </div>)}
        </div>
        <button className="secondary-button kh-identity-add-wallet" type="button" disabled={wallets.length >= 20} onClick={() => setWallets(old => [...old, newWallet()])}>+ Add wallet address</button>
        </fieldset>
        <div className="kh-identity-section-save"><span>{walletsEditing ? "Edit your wallet addresses, then save to lock them again." : "Wallet addresses are locked until you choose to edit."}</span><button className="submit-button" type="button" onClick={() => { if (!walletsEditing) { setWalletsEditing(true); setNotice(""); } else void saveWallets().then(saved => { if (saved) setWalletsEditing(false); }); }} disabled={savingWallets}>{savingWallets ? <LoadingDots /> : walletsEditing ? 'Save Wallets' : 'Edit Wallets'}</button></div>
      </section>
      <p className="kh-identity-footnote">Never share your password or verification codes. Only enter public wallet receiving addresses here.</p>
  </div>;
}

function SecurityIcon({ type }: { type: 'wallet' | 'lock' }) {
  const path = type === 'wallet' ? 'M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12 M16 12h5' : 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3';
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} /></svg>;
}
