import { useEffect, useMemo, useState } from 'react';

type ExitSettings = { idleEnabled: boolean; idleMinutes: number; scheduledExitAt: string };
type Props = { userId?: string; onExit: () => void; onStaySignedIn: () => void };
const defaults: ExitSettings = { idleEnabled: false, idleMinutes: 10, scheduledExitAt: '' };
const keyFor = (userId?: string) => 'kh_exit_settings_' + (userId || 'guest');
function readSettings(key: string): ExitSettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}') as Partial<ExitSettings>;
    return {
      idleEnabled: value.idleEnabled === true,
      idleMinutes: [5, 10, 15, 20, 25, 30].includes(Number(value.idleMinutes)) ? Number(value.idleMinutes) : 10,
      scheduledExitAt: typeof value.scheduledExitAt === 'string' ? value.scheduledExitAt : ''
    };
  } catch { return { ...defaults }; }
}
function localDateTimeValue(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

export default function ExitPage({ userId, onExit, onStaySignedIn }: Props) {
  const settingsKey = useMemo(() => keyFor(userId), [userId]);
  const [settings, setSettings] = useState<ExitSettings>(() => readSettings(keyFor(userId)));
  const [draftMinutes, setDraftMinutes] = useState(settings.idleMinutes);
  const [draftScheduleDate, setDraftScheduleDate] = useState(() => {
    const date = new Date(settings.scheduledExitAt);
    return Number.isFinite(date.getTime()) ? [String(date.getDate()).padStart(2, '0'), String(date.getMonth() + 1).padStart(2, '0'), date.getFullYear()].join('/') : '';
  });
  const [draftScheduleTime, setDraftScheduleTime] = useState(() => {
    const date = new Date(settings.scheduledExitAt);
    return Number.isFinite(date.getTime()) ? String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0') : '';
  });
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const next = readSettings(settingsKey);
    setSettings(next);
    setDraftMinutes(next.idleMinutes);
    const scheduleDate = new Date(next.scheduledExitAt);
    setDraftScheduleDate(Number.isFinite(scheduleDate.getTime()) ? [String(scheduleDate.getDate()).padStart(2, '0'), String(scheduleDate.getMonth() + 1).padStart(2, '0'), scheduleDate.getFullYear()].join('/') : '');
    setDraftScheduleTime(Number.isFinite(scheduleDate.getTime()) ? String(scheduleDate.getHours()).padStart(2, '0') + ':' + String(scheduleDate.getMinutes()).padStart(2, '0') : '');
    setStatus('');
  }, [settingsKey]);

  const persist = (next: ExitSettings, message: string) => {
    setSaving(true);
    try {
      localStorage.setItem(settingsKey, JSON.stringify(next));
      setSettings(next);
      setDraftMinutes(next.idleMinutes);
      const scheduleDate = new Date(next.scheduledExitAt);
    setDraftScheduleDate(Number.isFinite(scheduleDate.getTime()) ? [String(scheduleDate.getDate()).padStart(2, '0'), String(scheduleDate.getMonth() + 1).padStart(2, '0'), scheduleDate.getFullYear()].join('/') : '');
    setDraftScheduleTime(Number.isFinite(scheduleDate.getTime()) ? String(scheduleDate.getHours()).padStart(2, '0') + ':' + String(scheduleDate.getMinutes()).padStart(2, '0') : '');
      window.dispatchEvent(new CustomEvent('kh:exit-settings-changed', { detail: { userId } }));
      setStatus(message);
    } catch {
      setStatus('KingsHall could not save these settings on this device.');
    } finally {
      setSaving(false);
    }
  };

  const saveIdle = (enabled = settings.idleEnabled, minutes = draftMinutes) => {
    persist({ ...settings, idleEnabled: enabled, idleMinutes: minutes }, enabled ? `Automatic idle exit is enabled after ${minutes} minutes.` : 'Automatic idle exit is disabled.');
  };

  const saveSchedule = () => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(draftScheduleDate);
    const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draftScheduleTime);
    if (!match || !validTime) {
      setStatus('Enter a valid date in DD/MM/YYYY format and time in HH:MM format.');
      return;
    }
    const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
    const hour = Number(draftScheduleTime.slice(0, 2)), minute = Number(draftScheduleTime.slice(3, 5));
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getTime() <= Date.now()) {
      setStatus('Choose a valid future date and time for scheduled exit.');
      return;
    }
    persist({ ...settings, scheduledExitAt: date.toISOString() }, `Scheduled exit saved for ${formatDate(date.toISOString())}.`);
  };

  const cancelSchedule = () => persist({ ...settings, scheduledExitAt: '' }, 'Scheduled exit cancelled.');

  return <section className="kh-exit-page" aria-labelledby="kh-exit-title">
    <header className="kh-exit-heading">
      <span className="eyebrow"><span className="eyebrow-line" />SESSION CONTROL</span>
      <h1 id="kh-exit-title">Exit <em>settings.</em></h1>
      <p>Choose when KingsHall should end this session, or sign out whenever you are ready.</p>
    </header>

    <section className="kh-exit-card kh-exit-idle-card">
      <div className="kh-exit-panel">
        <section className="kh-exit-setting">
          <div className="kh-exit-setting-heading"><span className="kh-home-card-icon" aria-hidden="true">◷</span><div><h2>Exit when idle</h2><p>End your session after a period without activity. Moving, tapping, scrolling or typing resets the timer.</p></div></div>
          <div className="kh-exit-control">
            <div className="kh-exit-value-row"><span>Idle timeout</span><strong>{draftMinutes} minutes</strong></div>
            <input className="kh-exit-range" type="range" min="5" max="30" step="5" value={draftMinutes} onChange={event => setDraftMinutes(Number(event.target.value))} disabled={saving || exiting} aria-label="Idle exit timeout in minutes" />
            <div className="kh-exit-range-labels"><span>5 min</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30 min</span></div>
          </div>
          <div className="kh-exit-actions">
            {settings.idleEnabled && draftMinutes !== settings.idleMinutes && <button type="button" className="secondary-button" disabled={saving} onClick={() => saveIdle(true, draftMinutes)}>{saving ? 'Saving…' : 'Save timeout'}</button>}
            <button type="button" className={settings.idleEnabled ? 'secondary-button' : 'primary-button'} aria-pressed={settings.idleEnabled} disabled={saving} onClick={() => saveIdle(!settings.idleEnabled, draftMinutes)}>{saving ? 'Saving…' : settings.idleEnabled ? 'Disable idle exit' : 'Enable idle exit'}</button>
          </div>
          <p className="kh-exit-inline-status">{settings.idleEnabled ? `Enabled · signs out after ${settings.idleMinutes} minutes of inactivity.` : 'Disabled · your session will remain active until you sign out or it expires.'}</p>
        </section>
      </div>
    </section>

    <section className="kh-exit-card kh-exit-scheduled-card">
      <div className="kh-exit-panel">
        <section className="kh-exit-setting">
          <div className="kh-exit-setting-heading"><span className="kh-home-card-icon" aria-hidden="true">◴</span><div><h2>Scheduled exit</h2><p>Choose a future date and time for KingsHall to end this session automatically.</p></div></div>
          {settings.scheduledExitAt && <p className="kh-exit-schedule-current">Currently scheduled for <strong>{formatDate(settings.scheduledExitAt)}</strong></p>}
          <div className="kh-exit-schedule-form">
            <div className="field"><label htmlFor="kh-scheduled-exit-date">Date</label><input id="kh-scheduled-exit-date" type="text" inputMode="numeric" autoComplete="off" placeholder="DD/MM/YYYY" maxLength={10} value={draftScheduleDate} onChange={event => { const digits = event.target.value.replace(/\D/g, "").slice(0, 8); setDraftScheduleDate(digits.length <= 2 ? digits : digits.length <= 4 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4)); }} disabled={saving || exiting} /></div>
            <div className="field"><label htmlFor="kh-scheduled-exit-time">Time</label><input id="kh-scheduled-exit-time" type="text" inputMode="numeric" autoComplete="off" placeholder="HH:MM" maxLength={5} value={draftScheduleTime} onChange={event => { const digits = event.target.value.replace(/\D/g, "").slice(0, 4); setDraftScheduleTime(digits.length > 2 ? digits.slice(0, 2) + ":" + digits.slice(2) : digits); }} disabled={saving || exiting} /></div>
            <div className="kh-exit-actions">
              <button type="button" className="primary-button" disabled={saving || exiting || !draftScheduleDate || !draftScheduleTime} onClick={saveSchedule}>{saving ? 'Saving…' : settings.scheduledExitAt ? 'Update schedule' : 'Save scheduled exit'}</button>
              {settings.scheduledExitAt && <button type="button" className="secondary-button" disabled={saving} onClick={cancelSchedule}>Cancel schedule</button>}
            </div>
          </div>
          <p className="kh-exit-inline-status" aria-live="polite">{status || (settings.scheduledExitAt ? 'Scheduled exit is active on this device.' : 'No scheduled exit configured.')}</p>
        </section>
        <p className="kh-exit-footnote">These exit preferences are saved on this browser or device and apply to this KingsHall session. Scheduled exit is checked when KingsHall is open or resumes.</p>
      </div>
    </section>

    <section className="kh-exit-card kh-exit-manual-card">
      <div className="kh-exit-panel">
        <section className="kh-exit-setting kh-exit-manual-warning" role="alert">
          <div className="kh-exit-setting-heading"><span className="kh-home-card-icon" aria-hidden="true">!</span><div><h2>Ready to sign out?</h2><p>Your current KingsHall session will be ended and you will return to the landing page. You may need to sign in again to continue.</p></div></div>
          <p className="kh-exit-warning-copy"><strong>Before exiting, save any work or finish any action you do not want to lose.</strong></p>
          <div className="kh-exit-actions kh-exit-manual-actions">
            <button type="button" className="secondary-button" disabled={exiting} onClick={onStaySignedIn}>Keep me signed in</button>
            <button type="button" className="primary-button kh-exit-danger-button" disabled={exiting} onClick={() => { setExiting(true); onExit(); }}>{exiting ? 'Signing out…' : 'Exit now'}</button>
          </div>
        </section>
      </div>
    </section>
  </section>;
}
