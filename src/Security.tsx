import { useEffect, useState } from 'react';
import Toast from './Toast';

type Wallet = { id: string; label: string; network: string; address: string };
type Profile = {
  id?: string; firstName?: string; middleName?: string; lastName?: string; username?: string; email?: string;
  dateOfBirth?: string; phone?: string; country?: string; state?: string; city?: string; address?: string;
  postalCode?: string; nationality?: string; gender?: string; occupation?: string; bio?: string; avatarData?: string; coverPhoto?: string;
  website?: string; instagram?: string; facebook?: string; xHandle?: string; telegram?: string; discord?: string;
  linkedin?: string; language?: string; timeZone?: string; preferredCurrency?: string; pronouns?: string;
  relationshipStatus?: string; wallets?: Wallet[]; securityCodeSet?: boolean;
};
type Props = { user: { id: string; name: string; username: string; email: string; isEmailVerified: boolean } | null };
type ResponseData = { profile?: Profile; message?: string; error?: string };
const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');
const NETWORKS = ['TRC20', 'TRX', 'BRC20', 'ERC20', 'BEP20', 'BTC', 'SOL', 'TON', 'POLYGON', 'OTHER'];
function newWallet(): Wallet { return { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), label: '', network: 'TRC20', address: '' }; }

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
  const [securityDraft, setSecurityDraft] = useState({ password: '', kui: '', securityCode: '', accessCode: '', twoFactor: '', fundingCode: '' });
  const [loading, setLoading] = useState(true);
  const [savingWallets, setSavingWallets] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);

  useEffect(() => {
    let current = true;
    request('/api/identity').then(data => {
      if (!current) return;
      setWallets(data.profile?.wallets || []);
    }).catch(error => {
      if (current) { setNotice((error as Error).message || 'Could not load your security details.'); setNoticeOk(false); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user?.id]);

  function patchWallet(id: string, key: 'label' | 'network' | 'address', value: string) {
    setWallets(old => old.map(wallet => wallet.id === id ? { ...wallet, [key]: value } : wallet));
  }

  async function saveWallets() {
    if (savingWallets) return;
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
    } catch (error) {
      setNotice((error as Error).message || 'Could not save wallet addresses.');
      setNoticeOk(false);
    } finally { setSavingWallets(false); }
  }

  return <div className="kh-identity-page kh-security-page">
    <div className="kh-identity-heading">
      <span className="eyebrow"><span className="eyebrow-line" />ACCOUNT PROTECTION</span>
      <h1>KingsHall <em>Security.</em></h1>
      <p>Manage your wallet addresses and review account-protection settings from one dedicated page.</p>
    </div>
    <Toast message={notice} tone={noticeOk ? 'success' : 'error'} onClose={() => setNotice('')} />
    {loading ? <div className="kh-identity-loading">Loading your saved security details…</div> : <>
      <section className="kh-identity-card kh-identity-security">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon type="lock" /></span><div><h2>Account security</h2><p>Security settings are displayed here; the fields below are not yet connected to account-protection actions.</p></div></div>
        <div className="kh-identity-security-list">
          <div className="kh-identity-security-item"><div><strong>Verified email</strong><small>{user?.isEmailVerified ? 'Your account email is verified.' : 'Email verification status is not confirmed.'}</small></div><span className="kh-identity-code-status">{user?.isEmailVerified ? 'VERIFIED' : 'UNVERIFIED'}</span></div>
          <div className="kh-identity-security-item"><div><strong>Security code</strong><small>Use this area to review your security-code setup.</small></div><span className="kh-identity-code-status">ACCOUNT SETUP</span></div>
        </div>
        <div className="kh-identity-grid kh-identity-security-fields">
          <div className="field"><label htmlFor="security-password">Password</label><input id="security-password" type="password" autoComplete="new-password" placeholder="Enter password" value={securityDraft.password} onChange={e => setSecurityDraft(old => ({ ...old, password: e.target.value }))} /></div>
          <div className="field"><label htmlFor="security-kui">KUI (6-digit KingsHall Unique ID)</label><input id="security-kui" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="Enter 6-digit KUI" value={securityDraft.kui} onChange={e => setSecurityDraft(old => ({ ...old, kui: e.target.value.replace(/\D/g, '').slice(0, 6) }))} /></div>
          <div className="field"><label htmlFor="security-code">Security Code</label><input id="security-code" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} placeholder="Enter security code" value={securityDraft.securityCode} onChange={e => setSecurityDraft(old => ({ ...old, securityCode: e.target.value.replace(/\D/g, '').slice(0, 8) }))} /></div>
          <div className="field"><label htmlFor="security-access-code">Access Code</label><input id="security-access-code" type="password" autoComplete="off" placeholder="Enter access code" value={securityDraft.accessCode} onChange={e => setSecurityDraft(old => ({ ...old, accessCode: e.target.value }))} /></div>
          <div className="field"><label htmlFor="security-two-factor">2FA</label><select id="security-two-factor" value={securityDraft.twoFactor} onChange={e => setSecurityDraft(old => ({ ...old, twoFactor: e.target.value }))}><option value="">Choose status</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></div>
          <div className="field"><label htmlFor="security-funding-code">Funding Code</label><input id="security-funding-code" type="password" inputMode="numeric" autoComplete="off" maxLength={8} placeholder="Enter funding code" value={securityDraft.fundingCode} onChange={e => setSecurityDraft(old => ({ ...old, fundingCode: e.target.value.replace(/\D/g, '').slice(0, 8) }))} /></div>
        </div>
        <p className="kh-identity-help">These fields are interface-only for now. Do not enter real passwords, access codes, or funding codes until the related secure account flows are connected.</p>
      </section>
      <section className="kh-identity-card">
        <div className="kh-identity-card-head"><span className="kh-home-card-icon"><SecurityIcon type="wallet" /></span><div><h2>Wallets</h2><p>Save public receiving addresses by network. Never enter a seed phrase or private key.</p></div></div>
        <div className="kh-identity-wallets">
          {wallets.map((wallet, index) => <div className="kh-identity-wallet" key={wallet.id}>
            <div className="kh-identity-wallet-title"><strong>Wallet {index + 1}</strong><button type="button" onClick={() => setWallets(old => old.filter(item => item.id !== wallet.id))}>Remove</button></div>
            <div className="kh-identity-grid">
              <div className="field"><label htmlFor={'security-wallet-label-' + wallet.id}>Label <span className="optional">(optional)</span></label><input id={'security-wallet-label-' + wallet.id} maxLength={40} placeholder="e.g. Main USDT wallet" value={wallet.label} onChange={e => patchWallet(wallet.id, 'label', e.target.value)} /></div>
              <div className="field"><label htmlFor={'security-wallet-network-' + wallet.id}>Network</label><select id={'security-wallet-network-' + wallet.id} value={wallet.network} onChange={e => patchWallet(wallet.id, 'network', e.target.value)}>{NETWORKS.map(network => <option key={network} value={network}>{network === 'BRC20' ? 'BRC-20 (Bitcoin)' : network}</option>)}</select></div>
              <div className="field kh-identity-span"><label htmlFor={'security-wallet-address-' + wallet.id}>Wallet address</label><input id={'security-wallet-address-' + wallet.id} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200} placeholder="Paste public wallet address" value={wallet.address} onChange={e => patchWallet(wallet.id, 'address', e.target.value)} /></div>
            </div>
          </div>)}
        </div>
        <button className="secondary-button kh-identity-add-wallet" type="button" disabled={wallets.length >= 20} onClick={() => setWallets(old => [...old, newWallet()])}>+ Add wallet address</button>
        <div className="kh-identity-section-save"><span>Wallet addresses are saved separately from your personal and social details.</span><button className="submit-button" type="button" onClick={saveWallets} disabled={savingWallets}>{savingWallets ? 'Saving wallets…' : 'Save Wallets'}</button></div>
      </section>
      <p className="kh-identity-footnote">Never share your password or verification codes. Only enter public wallet receiving addresses here.</p>
    </>}
  </div>;
}

function SecurityIcon({ type }: { type: 'wallet' | 'lock' }) {
  const path = type === 'wallet' ? 'M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12 M16 12h5' : 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3';
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} /></svg>;
}
