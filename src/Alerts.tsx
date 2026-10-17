import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingDots from './components/LoadingDots';
import { alertsFetch } from './alertsClient';

type AlertItem = {
  id: string | number;
  category: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};
type Props = { version: number; onUnreadCount: (count: number) => void; onBack: () => void };
type Filter = 'all' | 'unread' | 'login' | 'security' | 'identity' | 'wallet' | 'profile';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All activity' },
  { id: 'unread', label: 'Unread' },
  { id: 'login', label: 'Sign-ins' },
  { id: 'security', label: 'Security' },
  { id: 'identity', label: 'Identity' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'profile', label: 'Profile' },
];

function AlertIcon({ category }: { category: string }) {
  const path = category === 'security' ? 'M12 3 19 6v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6zM9 12l2 2 4-4'
    : category === 'login' ? 'M12 3a4 4 0 0 0-4 4v2H6v11h12V9h-2V7a4 4 0 0 0-4-4ZM8 9h8M12 13v3'
    : category === 'wallet' ? 'M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12M16 12h5'
    : category === 'profile' ? 'M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8'
    : 'M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.5-3A7.5 7.5 0 1 1 20 11.5z';
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} /></svg>;
}

function dateOf(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function timeLabel(value: string) {
  const date = dateOf(value);
  if (!date) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function dayGroup(value: string) {
  const date = dateOf(value);
  if (!date) return 'Earlier';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (day === today) return 'Today';
  if (day === today - 86400000) return 'Yesterday';
  return 'Earlier';
}
function categoryLabel(value: string) {
  const known: Record<string, string> = { login: 'Sign-in', security: 'Security', identity: 'Identity', wallet: 'Wallet', profile: 'Profile' };
  return known[value?.toLowerCase()] || (value ? value.replace(/[_-]+/g, ' ') : 'Account');
}

export default function AlertsPage({ version, onUnreadCount, onBack }: Props) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await alertsFetch('/api/alerts?limit=50');
      const data = await response.json().catch(() => ({})) as { alerts?: AlertItem[]; unreadCount?: number; error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not load alerts.');
      setAlerts(data.alerts || []);
      setTotalUnread(data.unreadCount || 0);
      onUnreadCount(data.unreadCount || 0);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load alerts.');
    } finally { setLoading(false); }
  }, [onUnreadCount]);

  useEffect(() => { void load(); }, [load, version]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return alerts.filter(alert => {
      const category = (alert.category || '').toLowerCase();
      if (filter === 'unread' && alert.read_at) return false;
      if (!['all', 'unread'].includes(filter) && category !== filter) return false;
      if (term && ![alert.title, alert.message, categoryLabel(category)].some(value => value?.toLocaleLowerCase().includes(term))) return false;
      return true;
    });
  }, [alerts, filter, search]);

  const grouped = useMemo(() => {
    const order = ['Today', 'Yesterday', 'Earlier'];
    const groups = new Map<string, AlertItem[]>();
    filtered.forEach(alert => {
      const key = dayGroup(alert.created_at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(alert);
    });
    return order.filter(key => groups.has(key)).map(key => ({ title: key, items: groups.get(key)! }));
  }, [filtered]);

  async function markRead(alert: AlertItem) {
    if (alert.read_at || workingId || markingAll) return;
    setWorkingId(String(alert.id));
    try {
      const response = await alertsFetch('/api/alerts/' + encodeURIComponent(String(alert.id)) + '/read', { method: 'POST' });
      const data = await response.json().catch(() => ({})) as { error?: string; unreadCount?: number };
      if (!response.ok) throw new Error(data.error || 'Could not mark this alert as read.');
      setAlerts(current => current.map(item => String(item.id) === String(alert.id) ? { ...item, read_at: new Date().toISOString() } : item));
      if (typeof data.unreadCount === 'number') { setTotalUnread(data.unreadCount); onUnreadCount(data.unreadCount); }
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not mark this alert as read.'); }
    finally { setWorkingId(null); }
  }

  async function markAllRead() {
    if (markingAll || workingId || totalUnread === 0) return;
    setMarkingAll(true);
    try {
      const response = await alertsFetch('/api/alerts/read-all', { method: 'POST', body: '{}' });
      const data = await response.json().catch(() => ({})) as { error?: string; unreadCount?: number };
      if (!response.ok) throw new Error(data.error || 'Could not mark alerts as read.');
      const now = new Date().toISOString();
      setAlerts(current => current.map(item => ({ ...item, read_at: item.read_at || now })));
      setTotalUnread(0);
      onUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
      setLoadError('');
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not mark alerts as read.'); }
    finally { setMarkingAll(false); }
  }

  return <section className="kh-alerts-page" aria-labelledby="kh-alerts-title">
    <div className="kh-alerts-heading">
      <button className="kh-alerts-back" type="button" onClick={onBack} aria-label="Back to home"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18 9 12l6-6M9 12h11" /></svg><span>Home</span></button>
      <div className="kh-alerts-title-row">
        <div><span className="eyebrow"><span className="eyebrow-line" />ACCOUNT ACTIVITY</span><h1 id="kh-alerts-title">Alerts<span className="kh-alerts-title-period">.</span></h1><p className="kh-alerts-subtitle">Important changes and sign-ins, all in one place.</p></div>
        <div className="kh-alerts-total" aria-label={`${totalUnread} unread alerts`}><strong>{totalUnread > 99 ? '99+' : totalUnread}</strong><span>UNREAD</span></div>
      </div>
    </div>

    <div className="kh-alerts-control-panel">
      <label className="kh-alerts-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search your alerts…" aria-label="Search alerts" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button>}</label>
      <div className="kh-alerts-filter-row" role="group" aria-label="Filter alerts">
        {FILTERS.map(item => <button key={item.id} type="button" className={'kh-alert-filter' + (filter === item.id ? ' is-active' : '')} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}{item.id === 'unread' && totalUnread > 0 && <span>{totalUnread > 99 ? '99+' : totalUnread}</span>}</button>)}
      </div>
      <div className="kh-alerts-list-summary"><span>{loading ? 'Checking for activity…' : `${filtered.length} ${filtered.length === 1 ? 'alert' : 'alerts'}`}{filter !== 'all' || search ? ' found' : ''}</span><button type="button" className="kh-alerts-mark-all" onClick={() => void markAllRead()} disabled={markingAll || workingId !== null || totalUnread === 0}>{markingAll ? <><LoadingDots /> Updating</> : 'Mark all read'}</button></div>
    </div>

    {loadError && <div className="kh-alerts-error" role="alert"><span>{loadError}</span><button type="button" onClick={() => { setLoadError(''); setLoading(true); void load(); }}>Try again</button></div>}
    {loading ? <div className="kh-alerts-loading"><LoadingDots /><span> </span></div> : filtered.length === 0 ? <article className="kh-alerts-empty">
      <span className="kh-alerts-empty-icon"><AlertIcon category="general" /></span>
      <h2>{search || filter !== 'all' ? 'Nothing matches just yet.' : 'You’re all caught up.'}</h2>
      <p>{search || filter !== 'all' ? 'Try another search or switch the activity filter.' : 'New sign-ins, security actions, and identity changes will show up here automatically.'}</p>
      {(search || filter !== 'all') ? <button className="kh-alerts-reset" type="button" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button> : <button className="kh-alerts-reset" type="button" onClick={onBack}>Back to Home</button>}
    </article> : <div className="kh-alerts-groups">
      {grouped.map(group => <section className="kh-alerts-group" key={group.title} aria-label={group.title}>
        <h2 className="kh-alerts-group-title"><span>{group.title}</span><span>{group.items.length}</span></h2>
        <div className="kh-alerts-list">{group.items.map(alert => <article className={'kh-alert-item' + (alert.read_at ? '' : ' is-unread')} key={String(alert.id)}>
          <span className={'kh-alert-item-icon is-' + ((alert.category || 'general').toLowerCase())}><AlertIcon category={alert.category} /></span>
          <div className="kh-alert-item-content">
            <div className="kh-alert-item-top"><span className="kh-alert-category">{categoryLabel(alert.category)}</span>{!alert.read_at && <span className="kh-alert-new-pill">NEW</span>}</div>
            <h3>{alert.title}</h3><p>{alert.message}</p>
            <time dateTime={alert.created_at} title={dateOf(alert.created_at)?.toLocaleString() || ''}>{timeLabel(alert.created_at)}</time>
          </div>
          {!alert.read_at && <button className="kh-alert-read-button" type="button" aria-label={`Mark ${alert.title} as read`} title="Mark as read" disabled={workingId === String(alert.id) || markingAll} onClick={() => void markRead(alert)}>{workingId === String(alert.id) ? <LoadingDots /> : <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}</button>}
        </article>)}</div>
      </section>)}
      {alerts.length >= 50 && filter === 'all' && !search && <p className="kh-alerts-limit-note">Showing your 50 most recent alerts.</p>}
    </div>}
  </section>;
}
