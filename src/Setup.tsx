import { useEffect, useState } from 'react';
import { alertsFetch } from './alertsClient';
import ColorSelectionPage from './ColorSelectionPage';

type AlertType = 'signIns' | 'security' | 'identity' | 'wallet' | 'profile' | 'systemUpdates';
type Channels = { email: boolean; inApp: boolean; push: boolean };
type AlertTypes = Record<AlertType, boolean>;
const TYPE_OPTIONS: { key: AlertType; label: string; group: string }[] = [
  { key: 'signIns', label: 'Sign-ins & new devices', group: 'Account activity' },
  { key: 'security', label: 'Security changes', group: 'Account activity' },
  { key: 'identity', label: 'Identity updates', group: 'Account activity' },
  { key: 'wallet', label: 'Wallet activity', group: 'Ecosystem' },
  { key: 'profile', label: 'Profile changes', group: 'Ecosystem' },
  { key: 'systemUpdates', label: 'App updates & notices', group: 'System' },
];
const LIGHT_STYLES = [
  { value: 'stable-light', label: 'Steady light', description: 'A clean coloured edge, without glow' },
  { value: 'stable', label: 'Steady glow', description: 'A constant coloured glow' },
  { value: 'blink-light', label: 'Blink light', description: 'A gentle edge blink' },
  { value: 'blink', label: 'Blink glow', description: 'A blinking coloured glow' },
  { value: 'pulse-light', label: 'Pulse light', description: 'A soft breathing edge' },
  { value: 'pulse', label: 'Pulse glow', description: 'A stronger breathing glow' },
  { value: 'color-light', label: 'Rainbow light', description: 'Cycles through edge colours' },
  { value: 'color', label: 'Rainbow glow', description: 'Cycles through glowing colours' },
] as const;
function readBool(key: string, fallback: boolean) {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value === 'true';
}
function readColor(key: string, fallback: string) {
  const value = localStorage.getItem(key) || '';
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}
function readJson<T>(key: string, fallback: T): T {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return fallback; }
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={'kh-setup-toggle' + (checked ? ' is-on' : '')} onClick={() => onChange(!checked)}><span /></button>;
}
function ColorField({ value, onClick, disabled }: { value: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className={'kh-setup-color' + (disabled ? ' is-disabled' : '')} disabled={disabled} onClick={onClick} aria-label={'Choose colour, currently ' + value.toUpperCase()}><span className="kh-setup-color-swatch" style={{ background: value }} /><span>{value.toUpperCase()}</span><span className="kh-setup-color-action">Choose</span></button>;
}
function LightingStyleSelect({ value, onChange, disabled, label }: { value: string; onChange: (value: string) => void; disabled: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = LIGHT_STYLES.find(style => style.value === value) || LIGHT_STYLES[0];
  const filtered = LIGHT_STYLES.filter(style => (style.label + ' ' + style.description).toLowerCase().includes(search.trim().toLowerCase()));
  return <div className={'kh-nationality-field kh-setup-lighting-select' + (open ? ' is-open' : '')}>
    <button type="button" className="kh-nationality-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => { setOpen(current => !current); setSearch(''); }}>
      <span>{selected.label}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    </button>
    {open && !disabled && <div className="kh-nationality-popout">
      <input className="kh-nationality-search" type="search" aria-label={'Search ' + label.toLowerCase()} placeholder="Search lighting styles…" autoComplete="off" value={search} onChange={event => setSearch(event.target.value)} />
      <div className="kh-nationality-list" role="listbox" aria-label={label}>
        {filtered.map(style => <button type="button" role="option" aria-selected={value === style.value} className="kh-nationality-option" key={style.value} onClick={() => { onChange(style.value); setOpen(false); setSearch(''); }}>
          <span><strong>{style.label}</strong><span className="kh-setup-lighting-option-description">{style.description}</span></span>
          {value === style.value && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>}
        </button>)}
        {filtered.length === 0 && <p className="kh-nationality-empty">No matching lighting style found.</p>}
      </div>
    </div>}
  </div>;
}
export default function SetupPage() {
  const [nowbarEnabled, setNowbarEnabled] = useState(() => readBool('kh_nowbar_color_enabled', false));
  const [nowbarColor, setNowbarColor] = useState(() => readColor('kh_nowbar_color', '#b9c7df'));
  const [nowbarLight, setNowbarLight] = useState(() => localStorage.getItem('kh_nowbar_light_style') || 'stable');
  const [headerEnabled, setHeaderEnabled] = useState(() => readBool('kh_alert_color_enabled', true));
  const [headerColor, setHeaderColor] = useState(() => readColor('kh_alert_color', '#b9c7df'));
  const [headerLight, setHeaderLight] = useState(() => localStorage.getItem('kh_header_light_style') || 'stable');
  const [channels, setChannels] = useState<Channels>(() => readJson<Channels>('kh_alert_channels', { email: false, inApp: true, push: false }));
  const [types, setTypes] = useState<AlertTypes>(() => readJson<AlertTypes>('kh_alert_types', { signIns: true, security: true, identity: true, wallet: true, profile: true, systemUpdates: true }));
  const [notice, setNotice] = useState('Preferences save automatically on this device.');
  const [savedAt, setSavedAt] = useState('');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [colorPicker, setColorPicker] = useState<'nowbar' | 'header' | null>(null);

  useEffect(() => {
    localStorage.setItem('kh_nowbar_color_enabled', String(nowbarEnabled));
    localStorage.setItem('kh_nowbar_color', nowbarColor);
    localStorage.setItem('kh_nowbar_light_style', nowbarLight);
    window.dispatchEvent(new Event('kh:nowbar-color-changed'));
  }, [nowbarEnabled, nowbarColor, nowbarLight]);
  useEffect(() => {
    localStorage.setItem('kh_alert_color_enabled', String(headerEnabled));
    localStorage.setItem('kh_alert_color', headerColor);
    localStorage.setItem('kh_header_light_style', headerLight);
    window.dispatchEvent(new Event('kh:alert-color-changed'));
  }, [headerEnabled, headerColor, headerLight]);
  useEffect(() => {
    let cancelled = false;
    void alertsFetch('/api/alerts/preferences')
      .then(async response => {
        const payload = await response.json().catch(() => ({})) as { alertChannels?: Channels; alertTypes?: AlertTypes };
        if (!response.ok) return;
        if (cancelled) return;
        if (payload.alertChannels) setChannels(current => ({ ...current, ...payload.alertChannels }));
        if (payload.alertTypes) setTypes(current => ({ ...current, ...payload.alertTypes }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPreferencesLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    localStorage.setItem('kh_alert_channels', JSON.stringify(channels));
    localStorage.setItem('kh_alert_types', JSON.stringify(types));
    setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    if (!preferencesLoaded) return;
    void alertsFetch('/api/alerts/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertChannels: channels, alertTypes: types })
    }).then(response => {
      if (!response.ok) throw new Error('Unable to sync preferences.');
      setNotice('Preferences saved to your KingsHall account.');
    }).catch(() => setNotice('Preferences saved on this device. Account sync is temporarily unavailable.'));
  }, [channels, types, preferencesLoaded]);

  const updateChannel = (key: keyof Channels, value: boolean) => {
    setChannels(current => ({ ...current, [key]: value }));
    setNotice('Notification channel preferences updated.');
  };
  const updateType = (key: AlertType, value: boolean) => {
    setTypes(current => ({ ...current, [key]: value }));
    setNotice('Notification type preferences updated.');
  };
  const groups = [...new Set(TYPE_OPTIONS.map(option => option.group))];

  return <section className="kh-setup-page" aria-labelledby="kh-setup-title">
    <div className="kh-setup-heading">
      <span className="eyebrow"><span className="eyebrow-line" />PERSONAL PREFERENCES</span>
      <h1 id="kh-setup-title">Setup<span className="kh-setup-period">.</span></h1>
      <p>Shape the KingsHall interface, lighting, and the alerts you want to receive.</p>
    </div>

    <article className="kh-setup-card">
      <div className="kh-setup-card-heading"><span className="kh-setup-icon" aria-hidden="true">◈</span><div><h2>Nowbar appearance</h2><p>Customise the quick-navigation bar and its ambient lighting.</p></div></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Nowbar colour and lighting</strong><span>Enable a coloured edge and glow around the Nowbar.</span></div><Toggle checked={nowbarEnabled} onChange={setNowbarEnabled} label="Enable Nowbar colour and lighting" /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Accent colour</strong><span>Choose the colour used by the Nowbar lighting.</span></div><ColorField value={nowbarColor} onClick={() => setColorPicker('nowbar')} disabled={!nowbarEnabled} /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Lighting style</strong><span>{LIGHT_STYLES.find(item => item.value === nowbarLight)?.description || 'Choose how the light behaves.'}</span></div><LightingStyleSelect value={nowbarLight} disabled={!nowbarEnabled} onChange={setNowbarLight} label="Nowbar lighting style" /></div>

    </article>

    <article className="kh-setup-card">
      <div className="kh-setup-card-heading"><span className="kh-setup-icon" aria-hidden="true">✧</span><div><h2>Alert header</h2><p>Control the accent and lighting used by the app's alert header.</p></div></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Header colour and lighting</strong><span>Apply your selected accent to the KingsHall header and alert indicator.</span></div><Toggle checked={headerEnabled} onChange={setHeaderEnabled} label="Enable alert header colour and lighting" /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Accent colour</strong><span>Choose the header's coloured edge and glow.</span></div><ColorField value={headerColor} onClick={() => setColorPicker('header')} disabled={!headerEnabled} /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Lighting style</strong><span>{LIGHT_STYLES.find(item => item.value === headerLight)?.description || 'Choose how the light behaves.'}</span></div><LightingStyleSelect value={headerLight} disabled={!headerEnabled} onChange={setHeaderLight} label="Alert header lighting style" /></div>

    </article>

    <article className="kh-setup-card">
      <div className="kh-setup-card-heading"><span className="kh-setup-icon" aria-hidden="true">♧</span><div><h2>Notification channels</h2><p>Choose where KingsHall should deliver supported notifications.</p></div></div>
      {([{ key: 'inApp', label: 'In-app alerts', description: 'Show activity in your KingsHall alerts centre.' }, { key: 'push', label: 'Push notifications', description: 'Allow device notifications when the app supports delivery.' }, { key: 'email', label: 'Email notifications', description: 'Receive supported account notices by email.' }] as { key: keyof Channels; label: string; description: string }[]).map(item => <div className="kh-setup-setting-row" key={item.key}><div className="kh-setup-setting-copy"><strong>{item.label}</strong><span>{item.description}</span></div><Toggle checked={channels[item.key]} onChange={value => updateChannel(item.key, value)} label={item.label} /></div>)}
      {!channels.inApp && !channels.push && !channels.email && <p className="kh-setup-inline-note">All notification channels are off. Important account activity may still appear when you open KingsHall.</p>}
    </article>

    <article className="kh-setup-card">
      <div className="kh-setup-card-heading"><span className="kh-setup-icon" aria-hidden="true">☷</span><div><h2>Notification types</h2><p>Select the kinds of account activity you want included in your alerts.</p></div></div>
      {groups.map(group => <div className="kh-setup-type-group" key={group}><span className="kh-setup-group-label">{group}</span>{TYPE_OPTIONS.filter(option => option.group === group).map(option => <label className="kh-setup-check-row" key={option.key}><span><strong>{option.label}</strong></span><input type="checkbox" checked={types[option.key]} onChange={event => updateType(option.key, event.target.checked)} /></label>)}</div>)}
      <div className="kh-setup-footer"><span>{notice}{savedAt ? ' · Saved ' + savedAt : ''}</span><button type="button" className="secondary-button" onClick={() => { setNowbarEnabled(false); setNowbarColor('#b9c7df'); setNowbarLight('stable'); setHeaderEnabled(true); setHeaderColor('#b9c7df'); setHeaderLight('stable'); setChannels({ email: false, inApp: true, push: false }); setTypes({ signIns: true, security: true, identity: true, wallet: true, profile: true, systemUpdates: true }); setNotice('Default preferences restored.'); }}>Restore defaults</button></div>
    </article>
    {colorPicker === 'nowbar' && <ColorSelectionPage color={nowbarColor} title="Choose Nowbar colour" description="Choose the accent colour used by the Nowbar edge light and glow." onChange={setNowbarColor} onClose={() => setColorPicker(null)} />}
    {colorPicker === 'header' && <ColorSelectionPage color={headerColor} title="Choose header colour" description="Choose the accent colour used by the KingsHall app header lighting." onChange={setHeaderColor} onClose={() => setColorPicker(null)} />}
  </section>;
}
