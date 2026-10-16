import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Toast from './Toast';

type Wallet = { id: string; label: string; network: string; address: string };
type IdentityProfile = {
  id: string; firstName: string; middleName: string; lastName: string; username: string; email: string; emailVerified: boolean; memberSince: string;
  dateOfBirth: string; phone: string; country: string; state: string; city: string; address: string;
  postalCode: string; nationality: string; gender: string; occupation: string; bio: string;
  website: string; instagram: string; facebook: string; xHandle: string; telegram: string; discord: string; linkedin: string;
  language: string; timeZone: string; preferredCurrency: string; pronouns: string; relationshipStatus: string;
  avatarData: string; wallets: Wallet[]; securityCodeSet: boolean; updatedAt: string | null;
};
type Props = { user: { id: string; name: string; username: string; email: string; isEmailVerified: boolean } | null };
const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');
const NETWORKS = ['TRC20', 'TRX', 'BRC20', 'ERC20', 'BEP20', 'BTC', 'SOL', 'TON', 'POLYGON', 'OTHER'];
function splitName(value: string | undefined) {
  const parts = (value || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '', lastName: parts.length > 1 ? parts[parts.length - 1] : '' };
}
function capitalizeNameInput(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
}
const blankProfile = (user: Props['user']): IdentityProfile => ({
  id: user?.id || '', ...splitName(user?.name), username: user?.username || '', email: user?.email || '',
  emailVerified: Boolean(user?.isEmailVerified), memberSince: '', dateOfBirth: '', phone: '', country: '',
  state: '', city: '', address: '', postalCode: '', nationality: '', gender: '', occupation: '', bio: '',
  website: '', instagram: '', facebook: '', xHandle: '', telegram: '', discord: '', linkedin: '',
  language: '', timeZone: '', preferredCurrency: 'USD', pronouns: '', relationshipStatus: '',
  avatarData: '', wallets: [], securityCodeSet: false, updatedAt: null
});
async function request(path: string, body?: unknown) {
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
        const refresh = await fetch(API + '/api/auth/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        const session = await refresh.json().catch(() => ({})) as { accessToken?: string; refreshToken?: string };
        if (refresh.ok && session.accessToken && session.refreshToken) {
          sessionStorage.setItem('kh_access', session.accessToken);
          sessionStorage.setItem('kh_refresh', session.refreshToken);
          response = await makeRequest(session.accessToken);
        }
      } catch { /* Keep the original API response so the user receives a useful error. */ }
    }
  }
  const data = await response.json().catch(() => ({})) as { profile?: IdentityProfile; message?: string; error?: string; securityCodeSet?: boolean; available?: boolean; validFormat?: boolean; providerAccepted?: boolean };
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
function newWallet(): Wallet { return { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), label: '', network: 'TRC20', address: '' }; }
async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file); const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be opened.')); };
    image.src = url;
  });
  const scale = Math.min(1, 512 / Math.max(source.naturalWidth, source.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Photo editing is not available on this device.');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}
export default function IdentityPage({ user }: Props) {
  const [profile, setProfile] = useState<IdentityProfile>(() => blankProfile(user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);
  const [securityDraft, setSecurityDraft] = useState({ password: '', kui: '', securityCode: '', accessCode: '', twoFactor: '', fundingCode: '' });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unsupported' | 'error'>('idle');
  function update<K extends keyof IdentityProfile>(key: K, value: IdentityProfile[K]) { setProfile(old => ({ ...old, [key]: value } as IdentityProfile)); }
  useEffect(() => {
    const username = profile.username;
    if (loading || username.length < 3 || !/^[a-z0-9]{3,24}$/.test(username)) {
      setUsernameStatus('idle');
      return;
    }
    let current = true;
    setUsernameStatus('checking');
    const timer = window.setTimeout(() => {
      request('/api/identity/username-availability?username=' + encodeURIComponent(username))
        .then(data => { if (current) setUsernameStatus(data.available ? 'available' : 'taken'); })
        .catch(() => { if (current) setUsernameStatus('error'); });
    }, 350);
    return () => { current = false; window.clearTimeout(timer); };
  }, [profile.username, loading, user?.id]);
  useEffect(() => {
    const email = profile.email;
    if (loading || !email) {
      setEmailStatus('idle');
      return;
    }
    // The current account already owns this address, so it must not be reported as taken.
    if (user?.email && email.toLowerCase() === user.email.trim().toLowerCase()) {
      setEmailStatus('available');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('invalid');
      return;
    }
    let current = true;
    setEmailStatus('checking');
    const timer = window.setTimeout(() => {
      request('/api/identity/email-availability?email=' + encodeURIComponent(email))
        .then(data => {
          if (!current) return;
          if (!data.validFormat) setEmailStatus('invalid');
          else if (!data.providerAccepted) setEmailStatus('unsupported');
          else setEmailStatus(data.available ? 'available' : 'taken');
        })
        .catch(() => { if (current) setEmailStatus('error'); });
    }, 350);
    return () => { current = false; window.clearTimeout(timer); };
  }, [profile.email, loading, user?.id]);
  useEffect(() => {
    let live = true;
    request('/api/identity').then(data => { if (live && data.profile) setProfile(data.profile); })
      .catch(error => { if (live) { setProfile(blankProfile(user)); setNotice(error.message || 'Could not load your identity.'); setNoticeOk(false); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [user?.id]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    if (!/^[a-z0-9]{3,24}$/.test(profile.username) || usernameStatus !== 'available') {
      setNotice(usernameStatus === 'taken' ? 'That username is already taken. Choose another one.' : usernameStatus === 'checking' ? 'Please wait while we check username availability.' : usernameStatus === 'error' ? 'Could not verify username availability. Try again.' : 'Choose a valid username and wait for its availability check.');
      setNoticeOk(false);
      return;
    }
    if (!profile.email || emailStatus !== 'available') {
      const emailMessage = emailStatus === 'invalid' ? 'Enter a valid email address.' : emailStatus === 'unsupported' ? 'Please use an email address from an accepted email provider.' : emailStatus === 'taken' ? 'That email address is already in use.' : emailStatus === 'checking' ? 'Please wait while we check your email address.' : emailStatus === 'error' ? 'Could not verify your email address. Try again.' : 'Enter an email address from an accepted provider and wait for its check.';
      setNotice(emailMessage);
      setNoticeOk(false);
      return;
    }
    setSaving(true); setNotice('');
    try {
      const data = await request('/api/identity', {
        firstName: profile.firstName, middleName: profile.middleName, lastName: profile.lastName, username: profile.username, email: profile.email,
        dateOfBirth: profile.dateOfBirth, phone: profile.phone, country: profile.country, state: profile.state,
        city: profile.city, address: profile.address, postalCode: profile.postalCode, nationality: profile.nationality,
        gender: profile.gender, occupation: profile.occupation, bio: profile.bio, avatarData: profile.avatarData,
        website: profile.website, instagram: profile.instagram, facebook: profile.facebook, xHandle: profile.xHandle,
        telegram: profile.telegram, discord: profile.discord, linkedin: profile.linkedin,
        language: profile.language, timeZone: profile.timeZone, preferredCurrency: profile.preferredCurrency,
        pronouns: profile.pronouns, relationshipStatus: profile.relationshipStatus, wallets: profile.wallets
      });
      if (data.profile) setProfile(data.profile);
      setNotice(data.message || 'Your identity has been saved.'); setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Could not save your identity.'); setNoticeOk(false); }
    finally { setSaving(false); }
  }
  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setPhotoBusy(true); setNotice('');
    try { update('avatarData', await preparePhoto(file)); setNotice('Photo ready. Save your identity to keep it.'); setNoticeOk(true); }
    catch (error) { setNotice((error as Error).message || 'Could not load that photo.'); setNoticeOk(false); }
    finally { setPhotoBusy(false); }
  }
  function patchWallet(id: string, key: 'label' | 'network' | 'address', value: string) {
    setProfile(old => ({ ...old, wallets: old.wallets.map(wallet => wallet.id === id ? { ...wallet, [key]: value } : wallet) }));
  }
  return <div className="kh-identity-page">
    <div className="kh-identity-heading">
      <span className="eyebrow"><span className="eyebrow-line" />CENTRAL MEMBER RECORD</span>
      <h1>KingsHall <em>Identity.</em></h1>
      <p>Your central profile for KingsHall and connected applications. Add the details you want KingsHall to securely retain.</p>
    </div>
    <Toast message={notice} tone={noticeOk ? 'success' : 'error'} onClose={() => setNotice('')} />
    {loading ? <div className="kh-identity-loading">Loading your saved identity…</div> : <>
      <form className="kh-identity-form" onSubmit={save}>
        <section className="kh-identity-card kh-identity-personal">
          <div className="kh-identity-card-head"><span className="kh-home-card-icon"><FeatureIconPlaceholder type="person" /></span><div><h2>Personal</h2><p>Core details connected to your KingsHall account.</p></div></div>
          <div className="kh-identity-avatar-row">
            <div className="kh-identity-avatar">{profile.avatarData ? <img src={profile.avatarData} alt="Your profile" /> : <span>{(profile.firstName || 'K').trim().charAt(0).toUpperCase()}</span>}</div>
            <div className="kh-identity-avatar-copy"><strong>Profile photo</strong><small>Square or portrait image · automatically resized</small><label className="kh-identity-upload">{photoBusy ? 'Preparing photo…' : 'Choose photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={photoBusy} /></label></div>
            {profile.avatarData && <button className="kh-identity-remove-photo" type="button" onClick={() => update('avatarData', '')}>Remove</button>}
          </div>
          <div className="kh-identity-grid">
            <div className="field"><label htmlFor="identity-first-name">First name</label><input id="identity-first-name" maxLength={80} autoComplete="given-name" value={profile.firstName} onChange={e => update('firstName', capitalizeNameInput(e.target.value))} required /></div>
            <div className="field"><label htmlFor="identity-middle-name">Middle name <span className="optional">(if any)</span></label><input id="identity-middle-name" maxLength={80} autoComplete="additional-name" value={profile.middleName} onChange={e => update('middleName', capitalizeNameInput(e.target.value))} /></div>
            <div className="field"><label htmlFor="identity-last-name">Last name</label><input id="identity-last-name" maxLength={80} autoComplete="family-name" value={profile.lastName} onChange={e => update('lastName', capitalizeNameInput(e.target.value))} required /></div>
            <div className={`field kh-username-field is-${usernameStatus}`}><label htmlFor="identity-username">KingsHall username</label><div className="kh-username-input-wrap"><input id="identity-username" type="text" minLength={3} maxLength={24} pattern="[a-z0-9]{3,24}" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={profile.username} onChange={e => update('username', e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())} required />{profile.username.length > 0 && (usernameStatus === 'checking' ? <span className="kh-username-spinner kh-username-indicator" role="status" aria-label="Checking username availability" /> : usernameStatus === 'available' ? <svg className="kh-username-check kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Username available"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg> : usernameStatus === 'taken' ? <svg className="kh-username-unavailable kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Username unavailable"><circle cx="10" cy="10" r="8.25" /><path d="m7 7 6 6M13 7l-6 6" /></svg> : null)}</div></div>
            <div className={`field kh-email-field is-${emailStatus}`}><label htmlFor="identity-email">Email address</label><div className="kh-email-input-wrap"><input id="identity-email" type="email" maxLength={254} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={profile.email} onChange={e => update('email', e.target.value.toLowerCase().replace(/\s/g, ''))} required />{profile.email.length > 0 && (emailStatus === 'checking' ? <span className="kh-username-spinner kh-username-indicator" role="status" aria-label="Checking email address" /> : emailStatus === 'available' ? <svg className="kh-username-check kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Email accepted and available"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg> : ['taken', 'invalid', 'unsupported', 'error'].includes(emailStatus) ? <svg className="kh-username-unavailable kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Email invalid or unavailable"><circle cx="10" cy="10" r="8.25" /><path d="m7 7 6 6M13 7l-6 6" /></svg> : null)}</div></div>
          </div>
          <div className="kh-identity-grid">
            <div className="field"><label htmlFor="identity-dob">Date of birth</label><input id="identity-dob" type="date" max={new Date().toISOString().slice(0,10)} value={profile.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-phone">Phone number</label><input id="identity-phone" type="tel" autoComplete="tel" maxLength={32} placeholder="+234…" value={profile.phone} onChange={e => update('phone', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-nationality">Nationality</label><input id="identity-nationality" maxLength={80} autoComplete="country-name" placeholder="e.g. Nigerian" value={profile.nationality} onChange={e => update('nationality', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-country">Country of residence</label><input id="identity-country" maxLength={80} placeholder="Country" value={profile.country} onChange={e => update('country', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-state">State / region</label><input id="identity-state" maxLength={80} placeholder="State or region" value={profile.state} onChange={e => update('state', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-city">City</label><input id="identity-city" maxLength={80} placeholder="City" value={profile.city} onChange={e => update('city', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-postal">Postal code</label><input id="identity-postal" maxLength={24} placeholder="Postal code" value={profile.postalCode} onChange={e => update('postalCode', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-gender">Gender</label><select id="identity-gender" required value={profile.gender} onChange={e => update('gender', e.target.value)}><option value="" disabled>Select gender</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Other</option></select></div>
            <div className="field"><label htmlFor="identity-occupation">Occupation <span className="optional">(optional)</span></label><input id="identity-occupation" maxLength={100} placeholder="Occupation" value={profile.occupation} onChange={e => update('occupation', e.target.value)} /></div>
            <div className="field kh-identity-span"><label htmlFor="identity-address">Street address</label><input id="identity-address" autoComplete="street-address" maxLength={240} placeholder="Street address (optional)" value={profile.address} onChange={e => update('address', e.target.value)} /></div>
            <div className="field kh-identity-span"><label htmlFor="identity-bio">About you <span className="optional">(optional)</span></label><textarea id="identity-bio" rows={3} maxLength={500} placeholder="A short note about yourself…" value={profile.bio} onChange={e => update('bio', e.target.value)} /></div>
          </div>
        </section>
        <section className="kh-identity-card">
          <div className="kh-identity-card-head"><span className="kh-home-card-icon"><FeatureIconPlaceholder type="person" /></span><div><h2>Socials</h2><p>Optional public profiles and social contact handles.</p></div></div>
          <div className="kh-identity-grid">
            <div className="field"><label htmlFor="identity-website">Website</label><input id="identity-website" type="url" maxLength={240} placeholder="https://…" value={profile.website} onChange={e => update('website', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-instagram">Instagram</label><input id="identity-instagram" maxLength={100} placeholder="@username or profile URL" value={profile.instagram} onChange={e => update('instagram', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-facebook">Facebook</label><input id="identity-facebook" maxLength={160} placeholder="Profile URL or name" value={profile.facebook} onChange={e => update('facebook', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-x">X / Twitter</label><input id="identity-x" maxLength={100} placeholder="@username or profile URL" value={profile.xHandle} onChange={e => update('xHandle', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-telegram">Telegram</label><input id="identity-telegram" maxLength={100} placeholder="@username" value={profile.telegram} onChange={e => update('telegram', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-discord">Discord</label><input id="identity-discord" maxLength={100} placeholder="Username" value={profile.discord} onChange={e => update('discord', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-linkedin">LinkedIn</label><input id="identity-linkedin" maxLength={160} placeholder="Profile URL" value={profile.linkedin} onChange={e => update('linkedin', e.target.value)} /></div>
          </div>
        </section>
        <section className="kh-identity-card">
          <div className="kh-identity-card-head"><span className="kh-home-card-icon"><FeatureIconPlaceholder type="person" /></span><div><h2>Advanced</h2><p>Optional preferences and additional profile details.</p></div></div>
          <div className="kh-identity-grid">
            <div className="field"><label htmlFor="identity-pronouns">Pronouns</label><input id="identity-pronouns" maxLength={40} placeholder="Optional" value={profile.pronouns} onChange={e => update('pronouns', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-relationship">Relationship status</label><select id="identity-relationship" value={profile.relationshipStatus} onChange={e => update('relationshipStatus', e.target.value)}><option value="">Prefer not to say</option><option>Single</option><option>In a relationship</option><option>Married</option><option>It's complicated</option><option>Other</option></select></div>
            <div className="field"><label htmlFor="identity-language">Preferred language</label><input id="identity-language" maxLength={60} placeholder="e.g. English" value={profile.language} onChange={e => update('language', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-timezone">Time zone</label><input id="identity-timezone" maxLength={80} placeholder="e.g. Africa/Lagos" value={profile.timeZone} onChange={e => update('timeZone', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-currency">Preferred currency</label><select id="identity-currency" value={profile.preferredCurrency} onChange={e => update('preferredCurrency', e.target.value)}>{['USD','NGN','EUR','GBP','USDT','BTC','ETH','OTHER'].map(currency => <option key={currency}>{currency}</option>)}</select></div>
          </div>
        </section>
        <section className="kh-identity-card">
          <div className="kh-identity-card-head"><span className="kh-home-card-icon"><FeatureIconPlaceholder type="wallet" /></span><div><h2>Wallets</h2><p>Save receiving addresses by network. KingsHall stores addresses only; it never needs your seed phrase or private key.</p></div></div>
          <div className="kh-identity-wallets">
            {profile.wallets.map((wallet, index) => <div className="kh-identity-wallet" key={wallet.id}>
              <div className="kh-identity-wallet-title"><strong>Wallet {index + 1}</strong><button type="button" onClick={() => setProfile(old => ({ ...old, wallets: old.wallets.filter(item => item.id !== wallet.id) }))}>Remove</button></div>
              <div className="kh-identity-grid">
                <div className="field"><label htmlFor={'wallet-label-' + wallet.id}>Label <span className="optional">(optional)</span></label><input id={'wallet-label-' + wallet.id} maxLength={40} placeholder="e.g. Main USDT wallet" value={wallet.label} onChange={e => patchWallet(wallet.id, 'label', e.target.value)} /></div>
                <div className="field"><label htmlFor={'wallet-network-' + wallet.id}>Network</label><select id={'wallet-network-' + wallet.id} value={wallet.network} onChange={e => patchWallet(wallet.id, 'network', e.target.value)}>{NETWORKS.map(network => <option key={network} value={network}>{network === 'BRC20' ? 'BRC-20 (Bitcoin)' : network}</option>)}</select></div>
                <div className="field kh-identity-span"><label htmlFor={'wallet-address-' + wallet.id}>Wallet address</label><input id={'wallet-address-' + wallet.id} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200} placeholder="Paste public wallet address" value={wallet.address} onChange={e => patchWallet(wallet.id, 'address', e.target.value)} /></div>
              </div>
            </div>)}
          </div>
          <button className="secondary-button kh-identity-add-wallet" type="button" disabled={profile.wallets.length >= 20} onClick={() => setProfile(old => ({ ...old, wallets: [...old.wallets, newWallet()] }))}>+ Add wallet address</button>
        </section>
        <div className="kh-identity-save-row"><span>Your private details are visible only to your signed-in account through this API.</span><button className="submit-button" type="submit" disabled={saving}>{saving ? 'Saving identity…' : 'Save identity'}</button></div>
      </form>
      <section className="kh-identity-card kh-identity-security">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><FeatureIconPlaceholder type="lock" /></span><div><h2>Security</h2><p>Enter or edit these fields here for now. Security settings will be connected to their proper account-protection flows in a later step.</p></div></div>
        <div className="kh-identity-grid kh-identity-security-fields">
          <div className="field"><label htmlFor="identity-password">Password</label><input id="identity-password" type="password" autoComplete="new-password" placeholder="Enter password" value={securityDraft.password} onChange={e => setSecurityDraft(old => ({ ...old, password: e.target.value }))} /></div>
          <div className="field"><label htmlFor="identity-kui">KUI (6-digit KingsHall Unique ID)</label><input id="identity-kui" inputMode="numeric" autoComplete="off" maxLength={6} pattern="[0-9]{0,6}" placeholder="Enter 6-digit KUI" value={securityDraft.kui} onChange={e => setSecurityDraft(old => ({ ...old, kui: e.target.value.replace(/\D/g, '').slice(0, 6) }))} /></div>
          <div className="field"><label htmlFor="identity-security-code">Security Code</label><input id="identity-security-code" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} placeholder="Enter security code" value={securityDraft.securityCode} onChange={e => setSecurityDraft(old => ({ ...old, securityCode: e.target.value.replace(/\D/g, '').slice(0, 8) }))} /></div>
          <div className="field"><label htmlFor="identity-access-code">Access Code</label><input id="identity-access-code" type="password" autoComplete="off" placeholder="Enter access code" value={securityDraft.accessCode} onChange={e => setSecurityDraft(old => ({ ...old, accessCode: e.target.value }))} /></div>
          <div className="field"><label htmlFor="identity-two-factor">2FA</label><select id="identity-two-factor" value={securityDraft.twoFactor} onChange={e => setSecurityDraft(old => ({ ...old, twoFactor: e.target.value }))}><option value="">Choose status</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></div>
          <div className="field"><label htmlFor="identity-funding-code">Funding Code</label><input id="identity-funding-code" type="password" inputMode="numeric" autoComplete="off" maxLength={8} placeholder="Enter funding code" value={securityDraft.fundingCode} onChange={e => setSecurityDraft(old => ({ ...old, fundingCode: e.target.value.replace(/\D/g, '').slice(0, 8) }))} /></div>
        </div>
        <p className="kh-identity-help">These are editable interface fields only at this stage. Changes here are not yet saved or applied to your account security.</p>
      </section>
      <p className="kh-identity-footnote">Never enter a wallet seed phrase, private key, exchange password, or recovery phrase here. Use only public receiving addresses.</p>
    </>}
  </div>;
}
function FeatureIconPlaceholder({ type }: { type: 'person' | 'wallet' | 'lock' }) {
  const path = type === 'person' ? 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' : type === 'wallet' ? 'M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12 M16 12h5' : 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3';
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} /></svg>;
}
