import { useCallback, useEffect, useMemo, useState } from 'react';
import { alertsFetch } from './alertsClient';
type User = { id: string; name: string; username: string; email: string; isEmailVerified: boolean };
import './Statistics.css';
type Profile = { memberSince?: string; emailVerified?: boolean; securityCodeSet?: boolean; fundingCodeSet?: boolean; accessCodeSet?: boolean; wallets?: Array<{ address?: string }> };
type Activity = { id: string | number; category?: string; title?: string; message?: string; created_at: string; read_at?: string | null };
type Props = { user: User | null; deviceAccountStatus: string; onNavigate: (section: 'IDENTITY' | 'DEVICE' | 'SECURITY' | 'ALERTS') => void };
export default function StatisticsPage({ user, deviceAccountStatus, onNavigate }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [twoFactor, setTwoFactor] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [identityRes, twoFactorRes, alertsRes] = await Promise.all([alertsFetch('/api/identity'), alertsFetch('/api/identity/2fa/status'), alertsFetch('/api/alerts?limit=50')]);
      const [identity, twoFactorData, alertData] = await Promise.all([identityRes.json().catch(() => ({})) as Promise<{ profile?: Profile; error?: string }>, twoFactorRes.json().catch(() => ({})) as Promise<{ enabled?: boolean }>, alertsRes.json().catch(() => ({})) as Promise<{ alerts?: Activity[]; unreadCount?: number }>]);
      if (!identityRes.ok) throw new Error((identity as { error?: string }).error || 'Could not load account statistics.');
      setProfile(identity.profile || null);
      setTwoFactor(twoFactorRes.ok && twoFactorData.enabled === true);
      setActivities(alertsRes.ok ? (alertData.alerts || []) : []);
      setUnread(alertsRes.ok ? Number(alertData.unreadCount || 0) : 0);
      setError(!twoFactorRes.ok || !alertsRes.ok ? 'Some live statistics are temporarily unavailable.' : '');
      setLastUpdated(new Date().toISOString());
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not refresh account statistics.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let active = true; const run = () => { if (active) void refresh(); }; void refresh(true); const timer = window.setInterval(run, 30000); const visible = () => { if (document.visibilityState === 'visible') run(); }; window.addEventListener('focus', run); document.addEventListener('visibilitychange', visible); return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', run); document.removeEventListener('visibilitychange', visible); }; }, [refresh]);
  const checks = [Boolean(user?.isEmailVerified), Boolean(profile?.securityCodeSet), Boolean(profile?.fundingCodeSet), Boolean(profile?.accessCodeSet), twoFactor];
  const score = profile ? Math.round(checks.filter(Boolean).length / checks.length * 100) : null;
  const walletCount = (profile?.wallets || []).filter(w => Boolean(w.address?.trim())).length;
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); const key = date.toLocaleDateString(); const count = activities.filter(item => new Date(item.created_at).toLocaleDateString() === key).length; return { label: date.toLocaleDateString([], { weekday: 'short' }), count }; }), [activities]);
  const maxActivity = Math.max(1, ...days.map(day => day.count));
  const protections = [['Email verification', checks[0]], ['Security Code', checks[1]], ['Funding Code', checks[2]], ['Access Code', checks[3]], ['Authenticator (2FA)', checks[4]]] as const;
  return <section className="kh-stats-page" aria-labelledby="kh-stats-title">
    <header className="kh-stats-heading"><div><span className="eyebrow"><span className="eyebrow-line" />KINGSHALL LIVE OVERVIEW</span><p className="kh-home-greeting">WELCOME BACK, {(user?.name || 'MEMBER').trim().split(/\s+/)[0]}</p><h1 id="kh-stats-title">Your account <em>at a glance.</em></h1><p className="kh-home-intro">Live account, security and activity statistics, refreshed automatically.</p></div><div className="kh-stats-live"><i /><span>{loading ? 'SYNCING' : error ? 'PARTIAL DATA' : 'LIVE DATA'}</span><small>{lastUpdated ? 'Updated ' + new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Connecting to KingsHall'}</small><button type="button" onClick={() => void refresh(true)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh now'}</button></div></header>
    {error && <p className="kh-stats-notice" role="status">{error}</p>}
    <section className="kh-stats-metrics" aria-label="Account statistics">
      <article className="kh-stats-metric"><span>ACCOUNT STATUS</span><strong>{user?.isEmailVerified ? 'Verified' : 'Active'}</strong><small>{user?.isEmailVerified ? 'Email verification complete' : 'Email verification may be needed'}</small></article>
      <article className="kh-stats-metric"><span>SECURITY SCORE</span><strong>{score === null ? '—' : score + '%'}</strong><div className="kh-stats-progress"><i style={{ width: (score || 0) + '%' }} /></div><small>Five available account protections</small></article>
      <article className="kh-stats-metric"><span>SAVED WALLETS</span><strong>{profile ? walletCount : '—'}</strong><small>Public receiving addresses linked</small></article>
      <article className="kh-stats-metric"><span>UNREAD ALERTS</span><strong>{loading && !lastUpdated ? '—' : unread}</strong><small>Notices needing attention</small><button type="button" onClick={() => onNavigate('ALERTS')}>Review alerts ↗</button></article>
    </section>
    <section className="kh-stats-panels">
      <article className="kh-home-card kh-stats-panel"><div className="kh-home-card-top"><span className="kh-home-card-icon">↗</span><span className="kh-home-tag">RECENT ACTIVITY</span></div><div className="kh-stats-panel-title"><h2>Account activity</h2><span>{activities.length} recent</span></div><p className="kh-home-muted">Activity recorded by KingsHall over the last seven days.</p><div className="kh-stats-chart" role="img" aria-label="Account activity counts over the last seven days">{days.map(day => <div className="kh-stats-chart-day" key={day.label}><div className="kh-stats-chart-track"><i style={{ height: (day.count ? Math.max(8, day.count / maxActivity * 100) : 2) + '%' }} /></div><strong>{day.count}</strong><small>{day.label}</small></div>)}</div><div className="kh-stats-activity-list">{activities.slice(0, 5).map(item => <div className="kh-stats-activity-row" key={String(item.id)}><i className={item.read_at ? '' : 'is-new'} /><div><strong>{item.title || 'Account update'}</strong><small>{item.category || 'Account'} · {new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></div><span>{item.read_at ? 'Read' : 'New'}</span></div>)}{!loading && activities.length === 0 && <p className="kh-stats-empty">No recent account activity is available yet.</p>}</div><button className="kh-stats-wide-action" type="button" onClick={() => onNavigate('ALERTS')}>Open activity centre ↗</button></article>
      <article className="kh-home-card kh-stats-panel"><div className="kh-home-card-top"><span className="kh-home-card-icon">◇</span><span className="kh-home-tag">SECURITY LEVEL</span></div><h2>Your protection status</h2><p className="kh-home-muted">Live status reported by your KingsHall account.</p><div className="kh-stats-protections">{protections.map(([label, enabled]) => <div className="kh-stats-protection" key={label}><i className={enabled ? 'is-enabled' : ''}>{enabled ? '✓' : '–'}</i><span>{label}</span><strong>{enabled ? 'Enabled' : 'Not enabled'}</strong></div>)}</div><button className="kh-stats-wide-action" type="button" onClick={() => onNavigate('SECURITY')}>Manage security ↗</button></article>
    </section>
    <section className="kh-stats-panels kh-stats-lower"><article className="kh-home-card kh-stats-panel"><div className="kh-home-card-top"><span className="kh-home-card-icon">◎</span><span className="kh-home-tag">YOUR IDENTITY</span></div><h2>{user?.name || 'KingsHall member'}</h2><p className="kh-home-muted">@{user?.username || 'member'}</p><div className="kh-home-detail"><span>Email</span><strong>{user?.email || 'Not available'}</strong></div><div className="kh-home-detail"><span>Member since</span><strong>{profile?.memberSince ? new Date(profile.memberSince).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</strong></div><div className="kh-home-detail"><span>Device account</span><strong>{deviceAccountStatus}</strong></div><button className="kh-stats-wide-action" type="button" onClick={() => onNavigate('IDENTITY')}>View identity ↗</button></article>
      <article className="kh-home-card kh-stats-panel"><div className="kh-home-card-top"><span className="kh-home-card-icon">⌘</span><span className="kh-home-tag">CONNECTED APPS</span></div><h2>Your ecosystem</h2><p className="kh-home-muted">Open your KingsHall-connected experiences.</p><a className="kh-stats-app-link" href="https://crybots.kingshall.online" target="_blank" rel="noreferrer"><span><strong>CryBots</strong><small>Digital asset tools and bot experiences</small></span><b>↗</b></a><a className="kh-stats-app-link" href="https://hallschat.kingshall.online" target="_blank" rel="noreferrer"><span><strong>HallsChat</strong><small>Social connections and conversations</small></span><b>↗</b></a><button className="kh-stats-wide-action" type="button" onClick={() => onNavigate('DEVICE')}>Review device setup ↗</button></article></section>
    <footer className="kh-stats-footnote">Live statistics refresh every 30 seconds. Wallet counts represent saved addresses, not account balances.</footer>
  </section>;
}