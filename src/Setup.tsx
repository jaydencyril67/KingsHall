import { useEffect, useState, type CSSProperties } from 'react';

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
function ColorField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className={'kh-setup-color' + (disabled ? ' is-disabled' : '')}><span className="kh-setup-color-swatch" style={{ background: value }} /><span>{value.toUpperCase()}</span><input aria-label="Choose colour" type="color" value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /></label>;
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
    localStorage.setItem('kh_alert_channels', JSON.stringify(channels));
    localStorage.setItem('kh_alert_types', JSON.stringify(types));
    setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [channels, types]);

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
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Accent colour</strong><span>Choose the colour used by the Nowbar lighting.</span></div><ColorField value={nowbarColor} onChange={setNowbarColor} disabled={!nowbarEnabled} /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Lighting style</strong><span>{LIGHT_STYLES.find(item => item.value === nowbarLight)?.description || 'Choose how the light behaves.'}</span></div><select value={nowbarLight} disabled={!nowbarEnabled} onChange={event => setNowbarLight(event.target.value)} aria-label="Nowbar lighting style">{LIGHT_STYLES.map(style => <option key={style.value} value={style.value}>{style.label}</option>)}</select></div>
      <div className="kh-setup-preview"><span className="kh-setup-preview-label">LIVE PREVIEW</span><div className={'kh-setup-nowbar-preview ' + nowbarLight} style={{ '--setup-accent': nowbarEnabled ? nowbarColor : 'rgba(220,226,234,.25)' } as CSSProperties}><span className="kh-setup-preview-orb" /><strong>HOME</strong><span className="kh-setup-preview-chevron">⌄</span></div></div>
    </article>

    <article className="kh-setup-card">
      <div className="kh-setup-card-heading"><span className="kh-setup-icon" aria-hidden="true">✧</span><div><h2>Alert header</h2><p>Control the accent and lighting used by the app's alert header.</p></div></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Header colour and lighting</strong><span>Apply your selected accent to the KingsHall header and alert indicator.</span></div><Toggle checked={headerEnabled} onChange={setHeaderEnabled} label="Enable alert header colour and lighting" /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Accent colour</strong><span>Choose the header's coloured edge and glow.</span></div><ColorField value={headerColor} onChange={setHeaderColor} disabled={!headerEnabled} /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Lighting style</strong><span>{LIGHT_STYLES.find(item => item.value === headerLight)?.description || 'Choose how the light behaves.'}</span></div><select value={headerLight} disabled={!headerEnabled} onChange={event => setHeaderLight(event.target.value)} aria-label="Alert header lighting style">{LIGHT_STYLES.map(style => <option key={style.value} value={style.value}>{style.label}</option>)}</select></div>
      <div className="kh-setup-preview"><span className="kh-setup-preview-label">LIVE PREVIEW</span><div className={'kh-setup-header-preview ' + headerLight} style={{ '--setup-accent': headerEnabled ? headerColor : 'rgba(220,226,234,.25)' } as React.CSSProperties}><span className="kh-setup-preview-orb" /><strong>KINGSHALL</strong><span className="kh-setup-header-bell">♧</span></div></div>
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
  </section>;
}
