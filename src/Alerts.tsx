import { useCallback, useEffect, useState } from 'react';
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

function AlertIcon({ category }: { category: string }) {
  const path = category === 'security' ? 'M12 3 19 6v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6zM9 12l2 2 4-4'
    : category === 'login' ? 'M12 3a4 4 0 0 0-4 4v2H6v11h12V9h-2V7a4 4 0 0 0-4-4ZM8 9h8M12 13v3'
    : category === 'wallet' ? 'M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12M16 12h5'
    : 'M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.5-3A7.5 7.5 0 1 1 20 11.5z';
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} /></svg>;
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function AlertsPage({ version, onUnreadCount, onBack }: Props) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await alertsFetch('/api/alerts?limit=50');
      const data = await response.json().catch(() => ({})) as { alerts?: AlertItem[]; unreadCount?: number; error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not load alerts.');
      setAlerts(data.alerts || []);
      onUnreadCount(data.unreadCount || 0);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load alerts.');
    } finally { setLoading(false); }
  }, [onUnreadCount]);

  useEffect(() => { void load(); }, [load, version]);

  async function markRead(alert: AlertItem) {
    if (alert.read_at || workingId) return;
    setWorkingId(String(alert.id));
    try {
      const response = await alertsFetch('/api/alerts/' + encodeURIComponent(String(alert.id)) + '/read', { method: 'POST' });
      const data = await response.json().catch(() => ({})) as { error?: string; unreadCount?: number };
      if (!response.ok) throw new Error(data.error || 'Could not mark this alert as read.');
      setAlerts(current => current.map(item => String(item.id) === String(alert.id) ? { ...item, read_at: new Date().toISOString() } : item));
      if (typeof data.unreadCount === 'number') onUnreadCount(data.unreadCount);
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not mark this alert as read.'); }
    finally { setWorkingId(null); }
  }

  async function markAllRead() {
    if (markingAll || !alerts.some(item => !item.read_at)) return;
    setMarkingAll(true);
    try {
      const response = await alertsFetch('/api/alerts/read-all', { method: 'POST', body: '{}' });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not mark alerts as read.');
      const now = new Date().toISOString();
      setAlerts(current => current.map(item => ({ ...item, read_at: item.read_at || now })));
      onUnreadCount(0);
      setLoadError('');
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not mark alerts as read.'); }
    finally { setMarkingAll(false); }
  }

  const unread = alerts.filter(item => !item.read_at).length;
  return <section className="kh-alerts-page" aria-labelledby="kh-alerts-title">
    <div className="kh-home-heading">
      <span className="eyebrow"><span className="eyebrow-line" />KINGSHALL NOTIFICATIONS</span>
      <h1 id="kh-alerts-title">Your <em>alerts.</em></h1>
      <p className="kh-home-intro">Login activity, account changes, and important security notices — delivered as they happen.</p>
    </div>
    <div className="kh-alerts-toolbar">
      <span className="kh-alerts-count">{unread} unread {unread === 1 ? 'alert' : 'alerts'}</span>
      <button className="secondary-button kh-alerts-mark-all" type="button" onClick={markAllRead} disabled={markingAll || unread === 0}>{markingAll ? <LoadingDots /> : 'Mark all as read'}</button>
    </div>
    {loadError && <p className="kh-alerts-error" role="status">{loadError}</p>}
    {loading ? <div className="kh-home-card kh-alerts-loading"><LoadingDots /></div> : alerts.length === 0 ? <article className="kh-home-card kh-alerts-empty">
      <span className="kh-alerts-empty-icon"><AlertIcon category="general" /></span>
      <h2>You're all caught up.</h2>
      <p className="kh-home-muted">New sign-ins, security actions, and identity changes will appear here automatically.</p>
      <button className="secondary-button" type="button" onClick={onBack}>Back to Home</button>
    </article> : <div className="kh-alerts-list">
      {alerts.map(alert => <article className={'kh-home-card kh-alert-item' + (alert.read_at ? '' : ' is-unread')} key={String(alert.id)}>
        <span className="kh-alert-item-icon"><AlertIcon category={alert.category} /></span>
        <div className="kh-alert-item-content">
          <div className="kh-alert-item-top"><span className="kh-alert-category">{alert.category || 'account'}</span>{!alert.read_at && <span className="kh-alert-unread-dot" aria-label="Unread" />}</div>
          <h2>{alert.title}</h2>
          <p>{alert.message}</p>
          <time dateTime={alert.created_at}>{timeLabel(alert.created_at)}</time>
        </div>
        {!alert.read_at && <button className="kh-alert-read-button" type="button" disabled={workingId === String(alert.id)} onClick={() => void markRead(alert)}>{workingId === String(alert.id) ? <LoadingDots /> : 'Mark read'}</button>}
      </article>)}
    </div>}
  </section>;
}
