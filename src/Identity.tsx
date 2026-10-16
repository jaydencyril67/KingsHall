import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

type Wallet = { id: string; label: string; network: string; address: string };
type IdentityProfile = {
  id: string; name: string; username: string; email: string; emailVerified: boolean; memberSince: string;
  dateOfBirth: string; phone: string; country: string; state: string; city: string; address: string;
  postalCode: string; nationality: string; gender: string; occupation: string; bio: string;
  avatarData: string; wallets: Wallet[]; securityCodeSet: boolean; updatedAt: string | null;
};
type Props = { user: { id: string; name: string; username: string; email: string; isEmailVerified: boolean } | null };
const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');
const NETWORKS = ['TRC20', 'TRX', 'BRC20', 'ERC20', 'BEP20', 'BTC', 'SOL', 'TON', 'POLYGON', 'OTHER'];
const blankProfile = (user: Props['user']): IdentityProfile => ({
  id: user?.id || '', name: user?.name || '', username: user?.username || '', email: user?.email || '',
  emailVerified: Boolean(user?.isEmailVerified), memberSince: '', dateOfBirth: '', phone: '', country: '',
  state: '', city: '', address: '', postalCode: '', nationality: '', gender: '', occupation: '', bio: '',
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
  const data = await response.json().catch(() => ({})) as { profile?: IdentityProfile; message?: string; error?: string; securityCodeSet?: boolean };
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
  const [code, setCode] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  function update<K extends keyof IdentityProfile>(key: K, value: IdentityProfile[K]) { setProfile(old => ({ ...old, [key]: value })); }
  useEffect(() => {
    let live = true;
    request('/api/identity').then(data => { if (live && data.profile) setProfile(data.profile); })
      .catch(error => { if (live) { setProfile(blankProfile(user)); setNotice(error.message || 'Could not load your identity.'); setNoticeOk(false); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [user?.id]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setNotice('');
    try {
      const data = await request('/api/identity', {
        dateOfBirth: profile.dateOfBirth, phone: profile.phone, country: profile.country, state: profile.state,
        city: profile.city, address: profile.address, postalCode: profile.postalCode, nationality: profile.nationality,
        gender: profile.gender, occupation: profile.occupation, bio: profile.bio, avatarData: profile.avatarData,
        wallets: profile.wallets
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
  async function saveCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice('');
    try {
      const data = await request('/api/identity/security-code', { code, currentCode });
      setProfile(old => ({ ...old, securityCodeSet: Boolean(data.securityCodeSet) }));
      setCode(''); setCurrentCode(''); setNotice(data.message || 'Security code saved.'); setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Could not save your security code.'); setNoticeOk(false); }
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
    {notice && <div className={noticeOk ? 'notice notice-success kh-identity-notice' : 'notice kh-identity-notice'} role="status" aria-live="polite">{notice}</div>}
    {loading ? <div className="kh-identity-loading">Loading your saved identity…</div> : <>
      <form className="kh-identity-form" onSubmit={save}>
        <section className="kh-identity-card kh-identity-personal">
          <div className="kh-identity-card-head"><span className="kh-home-card-icon"><FeatureIconPlaceholder type="person" /></span><div><h2>Personal identity</h2><p>Core details connected to your KingsHall account.</p></div></div>
          <div className="kh-identity-avatar-row">
            <div className="kh-identity-avatar">{profile.avatarData ? <img src={profile.avatarData} alt="Your profile" /> : <span>{(profile.name || 'K').trim().charAt(0).toUpperCase()}</span>}</div>
            <div className="kh-identity-avatar-copy"><strong>Profile photo</strong><small>Square or portrait image · automatically resized</small><label className="kh-identity-upload">{photoBusy ? 'Preparing photo…' : 'Choose photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={photoBusy} /></label></div>
            {profile.avatarData && <button className="kh-identity-remove-photo" type="button" onClick={() => update('avatarData', '')}>Remove</button>}
          </div>
          <div className="kh-identity-readonly-grid">
            <div className="kh-identity-readonly"><span>Full name</span><strong>{profile.name || '—'}</strong></div>
            <div className="kh-identity-readonly"><span>KingsHall username</span><strong>@{profile.username || '—'}</strong></div>
            <div className="kh-identity-readonly"><span>Verified email</span><strong>{profile.email || '—'}</strong><small>{profile.emailVerified ? 'Verified' : 'Verification pending'}</small></div>
          </div>
          <div className="kh-identity-grid">
            <div className="field"><label htmlFor="identity-dob">Date of birth</label><input id="identity-dob" type="date" max={new Date().toISOString().slice(0,10)} value={profile.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-phone">Phone number</label><input id="identity-phone" type="tel" autoComplete="tel" maxLength={32} placeholder="+234…" value={profile.phone} onChange={e => update('phone', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-nationality">Nationality</label><input id="identity-nationality" maxLength={80} autoComplete="country-name" placeholder="e.g. Nigerian" value={profile.nationality} onChange={e => update('nationality', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-country">Country of residence</label><input id="identity-country" maxLength={80} placeholder="Country" value={profile.country} onChange={e => update('country', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-state">State / region</label><input id="identity-state" maxLength={80} placeholder="State or region" value={profile.state} onChange={e => update('state', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-city">City</label><input id="identity-city" maxLength={80} placeholder="City" value={profile.city} onChange={e => update('city', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-postal">Postal code</label><input id="identity-postal" maxLength={24} placeholder="Postal code" value={profile.postalCode} onChange={e => update('postalCode', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-gender">Gender <span className="optional">(optional)</span></label><select id="identity-gender" value={profile.gender} onChange={e => update('gender', e.target.value)}><option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Other</option></select></div>
            <div className="field"><label htmlFor="identity-occupation">Occupation <span className="optional">(optional)</span></label><input id="identity-occupation" maxLength={100} placeholder="Occupation" value={profile.occupation} onChange={e => update('occupation', e.target.value)} /></div>
            <div className="field kh-identity-span"><label htmlFor="identity-address">Street address</label><input id="identity-address" autoComplete="street-address" maxLength={240} placeholder="Street address (optional)" value={profile.address} onChange={e => update('address', e.target.value)} /></div>
            <div className="field kh-identity-span"><label htmlFor="identity-bio">About you <span className="optional">(optional)</span></label><textarea id="identity-bio" rows={3} maxLength={500} placeholder="A short note about yourself…" value={profile.bio} onChange={e => update('bio', e.target.value)} /></div>
          </div>
        </section>
        <section className="kh-identity-card">
          <div className="kh-identity-card-head"><span className="kh-home-card-icon"><FeatureIconPlaceholder type="wallet" /></span><div><h2>Crypto wallets</h2><p>Save receiving addresses by network. KingsHall stores addresses only; it never needs your seed phrase or private key.</p></div></div>
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
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><FeatureIconPlaceholder type="lock" /></span><div><h2>Security code</h2><p>A separate 4–8 digit code for future sensitive actions. It is stored as a one-way password hash, never as readable digits.</p></div><span className="kh-identity-code-status">{profile.securityCodeSet ? 'CODE SET' : 'NOT SET'}</span></div>
        <form onSubmit={saveCode}>
          {profile.securityCodeSet && <div className="field"><label htmlFor="identity-current-code">Current security code</label><input id="identity-current-code" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,8}" minLength={4} maxLength={8} value={currentCode} onChange={e => setCurrentCode(e.target.value)} required /></div>}
          <div className="field"><label htmlFor="identity-new-code">{profile.securityCodeSet ? 'New security code' : 'Create security code'}</label><input id="identity-new-code" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,8}" minLength={4} maxLength={8} value={code} onChange={e => setCode(e.target.value)} placeholder="4–8 digits" required /></div>
          <button className="secondary-button" type="submit">{profile.securityCodeSet ? 'Update security code' : 'Set security code'}</button>
        </form>
      </section>
      <p className="kh-identity-footnote">Never enter a wallet seed phrase, private key, exchange password, or recovery phrase here. Use only public receiving addresses.</p>
    </>}
  </div>;
}
function FeatureIconPlaceholder({ type }: { type: 'person' | 'wallet' | 'lock' }) {
  const path = type === 'person' ? 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' : type === 'wallet' ? 'M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12 M16 12h5' : 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3';
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} /></svg>;
}
