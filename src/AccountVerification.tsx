import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Check, Clock3, Mail, Send, ShieldCheck, X } from 'lucide-react';
import LoadingDots from './components/LoadingDots';

type VerificationRequest = { id: string; name: string; username: string; email: string; requestedAt: string | null };
type VerificationData = {
  status: 'none' | 'pending' | 'verified' | 'rejected';
  eligible?: boolean;
  eligibilityMessage?: string;
  requestedAt?: string | null;
  verifiedAt?: string | null;
  reviewNote?: string;
  canReview?: boolean;
  requests?: VerificationRequest[];
};
type ApiResult = VerificationData & { error?: string; message?: string; accessToken?: string; refreshToken?: string };
const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');

async function api(path: string, body?: unknown): Promise<ApiResult> {
  const send = (token: string | null) => fetch(API + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  let response: Response;
  try { response = await send(sessionStorage.getItem('kh_access')); }
  catch { throw new Error('Could not reach KingsHall. Check your connection and try again.'); }
  if (response.status === 401 && path !== '/api/auth/refresh') {
    const refreshToken = sessionStorage.getItem('kh_refresh');
    if (refreshToken) {
      try {
        const refresh = await fetch(API + '/api/auth/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken })
        });
        const session = await refresh.json().catch(() => ({})) as { accessToken?: string; refreshToken?: string };
        if (refresh.ok && session.accessToken && session.refreshToken) {
          sessionStorage.setItem('kh_access', session.accessToken);
          sessionStorage.setItem('kh_refresh', session.refreshToken);
          response = await send(session.accessToken);
        }
      } catch { /* Keep the original response when a refresh cannot complete. */ }
    }
  }
  const data = await response.json().catch(() => ({})) as ApiResult;
  if (!response.ok) throw new Error(data.error || data.message || 'KingsHall could not complete this request.');
  return data;
}

function when(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '';
}

export default function AccountVerification() {
  const [data, setData] = useState<VerificationData>({ status: 'none' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await api('/api/identity/verification')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load account verification.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function sendCode() {
    if (busy) return;
    setBusy(true); setNotice(''); setError('');
    try {
      const result = await api('/api/identity/verification/send-code', {});
      setCodeSent(true);
      setCode('');
      setNotice(result.message || 'A verification code has been sent to your KingsHall email address.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send the verification code.'); }
    finally { setBusy(false); }
  }

  async function submitRequest() {
    if (busy || !/^\d{6}$/.test(code)) return;
    setBusy(true); setNotice(''); setError('');
    try {
      const result = await api('/api/identity/verification/request', { code });
      setData(current => ({ ...current, ...result, status: 'pending', requestedAt: result.requestedAt || new Date().toISOString() }));
      setCodeSent(false); setCode('');
      setNotice(result.message || 'Your request has been sent to the KingsHall verification team for manual review.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not submit your verification request.'); }
    finally { setBusy(false); }
  }

  async function review(item: VerificationRequest, decision: 'approve' | 'reject') {
    if (busy) return;
    setBusy(true); setNotice(''); setError('');
    try {
      const result = await api('/api/identity/verification/review', { userId: item.id, decision, note: reviewNote });
      setNotice(result.message || 'The review decision has been saved in KingsHall.');
      setReviewNote('');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the review decision.'); }
    finally { setBusy(false); }
  }

  const panelStyle: React.CSSProperties = { display: 'grid', gap: 12 };
  const infoStyle: React.CSSProperties = { margin: 0, border: '1px solid var(--theme-border)', borderRadius: 12, padding: 12, color: 'var(--theme-muted)', fontSize: '.82rem', lineHeight: 1.55 };
  const inputStyle: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 42, padding: '10px 12px', border: '1px solid var(--theme-border-strong)', borderRadius: 10, background: 'var(--theme-surface)', color: 'var(--theme-text-primary)', font: 'inherit' };

  return <section className="kh-identity-card kh-identity-security" style={{ ...panelStyle, marginTop: 16 }}>
    <div className="kh-identity-card-head">
      <span className="kh-home-card-icon"><ShieldCheck size={20} /></span>
      <div><h2>Account verification {loading && <span className="kh-identity-section-loading" aria-label="Loading verification status"><LoadingDots /></span>}</h2><p>KingsHall manages the badge shared with connected applications.</p></div>
    </div>

    {!loading && <>
      {data.status === 'verified' ? <p role="status" style={{ margin: 0, color: 'var(--theme-success)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '.86rem' }}><BadgeCheck size={18} /> Your KingsHall account is verified{data.verifiedAt ? ' · ' + when(data.verifiedAt) : ''}.</p>
        : data.status === 'pending' ? <p role="status" style={{ margin: 0, color: 'var(--theme-primary-hover)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '.86rem' }}><Clock3 size={18} /> Your request is waiting for manual review.{data.requestedAt ? ' Submitted ' + when(data.requestedAt) + '.' : ''}</p>
        : <>
          <p style={infoStyle}>Your KingsHall account must be at least 30 days old. Every eligible request is reviewed manually by KingsHall. Followers, post counts, and likes do not affect eligibility.</p>
          {data.status === 'rejected' && data.reviewNote && <p role="status" style={{ ...infoStyle, color: 'var(--theme-danger)' }}>Review note: {data.reviewNote}</p>}
          {data.eligible === false && data.eligibilityMessage && <p role="status" style={{ ...infoStyle, color: 'var(--theme-muted)' }}>{data.eligibilityMessage}</p>}
          {!codeSent
            ? <button className="submit-button" type="button" disabled={busy || data.eligible === false} onClick={() => void sendCode()}>{busy ? <LoadingDots /> : <><Mail size={16} /> Confirm account by email</>}</button>
            : <form onSubmit={event => { event.preventDefault(); void submitRequest(); }} style={{ display: 'grid', gap: 10 }}>
                <input style={inputStyle} aria-label="Six-digit KingsHall verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="Six-digit email code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="submit-button" type="submit" disabled={busy || !/^\d{6}$/.test(code)}>{busy ? <LoadingDots /> : <><Send size={15} /> Submit for review</>}</button>
                  <button className="secondary-button" type="button" disabled={busy} onClick={() => { setCodeSent(false); setCode(''); }}>Cancel</button>
                </div>
              </form>}
        </>}
    </>}

    {notice && <p role="status" style={{ margin: 0, color: 'var(--theme-success)', fontSize: '.82rem' }}>{notice}</p>}
    {error && <p role="alert" style={{ margin: 0, color: 'var(--theme-danger)', fontSize: '.82rem' }}>{error}</p>}

    {data.canReview && <div style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--theme-border)', paddingTop: 14 }}>
      <div><h3 style={{ margin: 0, fontSize: '.95rem' }}>Manual review queue</h3><p style={{ margin: '4px 0 0', color: 'var(--theme-muted)', fontSize: '.78rem' }}>{data.requests?.length || 0} pending request(s)</p></div>
      <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} maxLength={500} aria-label="Optional verification review note" placeholder="Optional note for a declined request" value={reviewNote} onChange={event => setReviewNote(event.target.value)} />
      {(data.requests || []).length === 0 ? <p style={infoStyle}>There are no verification requests waiting for review.</p> : (data.requests || []).map(item => <article key={item.id} style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid var(--theme-border)', borderRadius: 12, background: 'var(--theme-card-raised)' }}>
        <div><strong>{item.name || 'KingsHall member'}</strong><span style={{ marginLeft: 6, color: 'var(--theme-primary-hover)', fontSize: '.82rem' }}>@{item.username || 'member'}</span><div style={{ color: 'var(--theme-muted)', fontSize: '.78rem', overflowWrap: 'anywhere' }}>{item.email}</div><small style={{ color: 'var(--theme-muted)' }}>Submitted {when(item.requestedAt) || 'date unavailable'}</small></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="submit-button" type="button" disabled={busy} onClick={() => void review(item, 'approve')}>{busy ? <LoadingDots /> : <><Check size={15} /> Approve</>}</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void review(item, 'reject')}><X size={15} /> Decline</button>
        </div>
      </article>)}
      <button className="secondary-button" type="button" disabled={busy || loading} onClick={() => void load()}>Refresh review queue</button>
    </div>}
    {loading && <div style={{ minHeight: 60, display: 'grid', placeItems: 'center' }}><LoadingDots /></div>}
  </section>;
}
