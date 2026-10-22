import { useEffect, useState } from 'react';
import Toast from './Toast';
import { Capacitor } from '@capacitor/core';
import { registerKingsHallNativePushToken, unregisterKingsHallNativePushToken } from './nativePush';
import { registerKingsHallWebPushSubscription, unregisterKingsHallWebPushSubscription } from './webPush';
import { NativeAppUpdate } from './utils/nativeAppUpdate';
import { alertsFetch } from './alertsClient';
import { openCrownStoreApp } from './utils/crownStore';
import ColorSelectionPage from './ColorSelectionPage';

type AlertType = 'signIns' | 'security' | 'identity' | 'wallet' | 'profile' | 'systemUpdates';
type ApkRelease = { status: 'checking' | 'update' | 'current' | 'latest' | 'error'; installedVersion?: string; latestVersion?: string; releaseNotes?: string; message?: string };
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
function LightingStyleSelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const selected = LIGHT_STYLES.find(style => style.value === value) || LIGHT_STYLES[0];
  return <div className={'kh-nationality-field kh-setup-lighting-select' + (open ? ' is-open' : '')}>
    <button type="button" className="kh-nationality-trigger kh-setup-lighting-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}>
      <span>{selected.label}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    </button>
    {open && <div className="kh-nationality-popout">
      <div className="kh-nationality-list" role="listbox" aria-label={label}>
        {LIGHT_STYLES.map(style => <button type="button" role="option" aria-selected={value === style.value} className="kh-nationality-option" key={style.value} onClick={() => { onChange(style.value); setOpen(false); }}>
          <span><strong>{style.label}</strong></span>
          {value === style.value && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>}
        </button>)}
      </div>
    </div>}
  </div>;
}
export default function SetupPage() {
  const [nowbarEnabled, setNowbarEnabled] = useState(() => readBool('kh_nowbar_color_enabled', false));
  const [nowbarColor, setNowbarColor] = useState(() => readColor('kh_nowbar_color', '#b9c7df'));
  const [nowbarLight, setNowbarLight] = useState(() => localStorage.getItem('kh_nowbar_light_style') || 'stable');
  const [buttonColorEnabled, setButtonColorEnabled] = useState(() => readBool('kh_nowbar_button_color_enabled', false));
  const [buttonColor, setButtonColor] = useState(() => readColor('kh_nowbar_button_color', '#b9c7df'));
  const [headerEnabled, setHeaderEnabled] = useState(() => readBool('kh_alert_color_enabled', true));
  const [headerColor, setHeaderColor] = useState(() => readColor('kh_alert_color', '#b9c7df'));
  const [channels, setChannels] = useState<Channels>(() => readJson<Channels>('kh_alert_channels', { email: false, inApp: true, push: false }));
  const [types, setTypes] = useState<AlertTypes>(() => readJson<AlertTypes>('kh_alert_types', { signIns: true, security: true, identity: true, wallet: true, profile: true, systemUpdates: true }));
  const [notice, setNotice] = useState('');
  const [apkRelease, setApkRelease] = useState<ApkRelease>({ status: 'checking' });
  const [apkActionMessage, setApkActionMessage] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [colorPicker, setColorPicker] = useState<'nowbar' | 'header' | 'button' | null>(null);
  const [activePanel, setActivePanel] = useState<'nowbar' | 'header' | 'channels' | 'types' | 'release' | null>(null);
  const checkApkRelease = async () => {
    setApkRelease(current => ({ ...current, status: 'checking', message: '' }));
    try {
      const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
      let appInfo: { versionName: string; versionCode: number } | null = null;
      if (isAndroid) {
        // Older installed APKs may predate the native updater plugin; still fetch the latest release
        // so the user can download the first updater-enabled APK through the browser fallback.
        try { appInfo = await NativeAppUpdate.getAppInfo(); } catch { appInfo = null; }
      }
      const query = appInfo?.versionName ? '?installedVersion=' + encodeURIComponent(appInfo.versionName) : '';
      const response = await alertsFetch('/api/notifications/app-update-check' + query, { cache: 'no-store' });
      const data = await response.json().catch(() => ({})) as { updateAvailable?: boolean; installedVersion?: string; latestVersion?: string; releaseNotes?: string; message?: string };
      if (!response.ok) throw new Error(data.message || 'Unable to check the latest KingsHall APK.');
      if (!data.latestVersion) throw new Error('No published KingsHall release is available yet.');
      setApkRelease({
        status: isAndroid && appInfo ? (data.updateAvailable ? 'update' : 'current') : 'latest',
        installedVersion: appInfo?.versionName || undefined,
        latestVersion: data.latestVersion,
        releaseNotes: data.releaseNotes || ''
      });
    } catch (error) {
      setApkRelease(current => ({ ...current, status: 'error', message: error instanceof Error ? error.message : 'Unable to check KingsHall updates.' }));
    }
  };

  const openLatestInCrownStore = () => {
    if (!apkRelease.latestVersion) return;
    openCrownStoreApp('kingshall', setApkActionMessage);
  };

  useEffect(() => {
    void checkApkRelease();
    const interval = window.setInterval(() => { void checkApkRelease(); }, 15 * 60 * 1000);
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void checkApkRelease(); };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!activePanel) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setActivePanel(null); };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); };
  }, [activePanel]);

  useEffect(() => {
    localStorage.setItem('kh_nowbar_color_enabled', String(nowbarEnabled));
    localStorage.setItem('kh_nowbar_color', nowbarColor);
    localStorage.setItem('kh_nowbar_light_style', nowbarLight);
    window.dispatchEvent(new Event('kh:nowbar-color-changed'));
  }, [nowbarEnabled, nowbarColor, nowbarLight]);
  useEffect(() => {
    localStorage.setItem('kh_alert_color_enabled', String(headerEnabled));
    localStorage.setItem('kh_alert_color', headerColor);
    window.dispatchEvent(new Event('kh:alert-color-changed'));
  }, [headerEnabled, headerColor]);
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
    localStorage.setItem('kh_nowbar_button_color_enabled', String(buttonColorEnabled));
    localStorage.setItem('kh_nowbar_button_color', buttonColor);
    window.dispatchEvent(new Event('kh:nowbar-button-color-changed'));
  }, [buttonColorEnabled, buttonColor]);

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
    if (key === 'push' && value) {
      void (async () => {
        try {
          const isAndroidApp = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
          if (isAndroidApp) await registerKingsHallNativePushToken(true);
          else await registerKingsHallWebPushSubscription();
          setChannels(current => ({ ...current, push: true }));
          setNotice(isAndroidApp ? 'Push notifications are enabled for this KingsHall Android device.' : 'Browser/PWA push notifications are enabled for this KingsHall device.');
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Unable to enable push notifications.');
        }
      })();
      return;
    }
    if (key === 'push' && !value) {
      void (async () => {
        const isAndroidApp = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
        try {
          if (isAndroidApp) await unregisterKingsHallNativePushToken();
          else await unregisterKingsHallWebPushSubscription();
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'The device could not be unregistered, but push will be disabled for this account.');
        } finally {
          setChannels(current => ({ ...current, push: false }));
          setNotice('Push notifications disabled for this KingsHall account.');
        }
      })();
      return;
    }
    setChannels(current => ({ ...current, [key]: value }));
    setNotice('Notification channel preferences updated.');
  };
  const updateType = (key: AlertType, value: boolean) => {
    setTypes(current => ({ ...current, [key]: value }));
    setNotice('Notification type preferences updated.');
  };
  const groups = [...new Set(TYPE_OPTIONS.map(option => option.group))];

  const panelContent = (panel: 'nowbar' | 'header' | 'channels' | 'types' | 'release') => {
    if (panel === 'nowbar') return <>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Colour and lighting</strong><span>Enable the Nowbar accent effect.</span></div><Toggle checked={nowbarEnabled} onChange={setNowbarEnabled} label="Enable Nowbar colour and lighting" /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Accent colour</strong></div><ColorField value={nowbarColor} onClick={() => setColorPicker('nowbar')} disabled={!nowbarEnabled} /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Lighting style</strong></div><LightingStyleSelect value={nowbarLight} onChange={setNowbarLight} label="Nowbar lighting style" /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Button border lighting</strong><span>Light up each navigation button separately, without changing the Nowbar edge light.</span></div><Toggle checked={buttonColorEnabled} onChange={setButtonColorEnabled} label="Enable individual Nowbar button border lighting" /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Button colour</strong></div><ColorField value={buttonColor} onClick={() => setColorPicker('button')} disabled={!buttonColorEnabled} /></div>
    </>;
    if (panel === 'header') return <>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Colour and lighting</strong><span>Accent the app header when alerts are unread.</span></div><Toggle checked={headerEnabled} onChange={setHeaderEnabled} label="Enable alert header colour and lighting" /></div>
      <div className="kh-setup-setting-row"><div className="kh-setup-setting-copy"><strong>Accent colour</strong></div><ColorField value={headerColor} onClick={() => setColorPicker('header')} disabled={!headerEnabled} /></div>
    </>;
    if (panel === 'channels') return <>
      {([{ key: 'inApp', label: 'In-app alerts', description: 'Show activity in your KingsHall alerts centre.' }, { key: 'push', label: 'Push notifications', description: 'Allow device notifications when supported.' }, { key: 'email', label: 'Email notifications', description: 'Receive supported account notices by email.' }] as { key: keyof Channels; label: string; description: string }[]).map(item => <div className="kh-setup-setting-row" key={item.key}><div className="kh-setup-setting-copy"><strong>{item.label}</strong><span>{item.description}</span></div><Toggle checked={channels[item.key]} onChange={value => updateChannel(item.key, value)} label={item.label} /></div>)}
      {!channels.inApp && !channels.push && !channels.email && <p className="kh-setup-inline-note">All notification channels are off. Important account activity may still appear when you open KingsHall.</p>}
    </>;
    if (panel === 'release') return <>
      <div className="kh-setup-release-version">
        <span className="kh-setup-release-mark" aria-hidden="true">↓</span>
        <div className="kh-setup-setting-copy">
          <strong>{apkRelease.status === 'checking' ? 'Checking latest version…' : apkRelease.status === 'error' ? 'Release check unavailable' : 'Latest version · KingsHall v' + (apkRelease.latestVersion || '—')}</strong>
          <span>{apkRelease.status === 'update' ? 'A newer signed Android release is available in CrownStore.' : apkRelease.status === 'current' ? 'This device is already using the latest release.' : apkRelease.status === 'latest' ? 'Latest KingsHall release is available in CrownStore.' : apkRelease.status === 'error' ? (apkRelease.message || 'Please try checking again.') : 'Checking for the latest KingsHall release.'}</span>
          {apkRelease.installedVersion && <span>Currently installed: v{apkRelease.installedVersion}</span>}
        </div>
      </div>
      {apkRelease.releaseNotes && <details className="kh-setup-release-notes"><summary>Release notes</summary><p>{apkRelease.releaseNotes}</p></details>}
      {apkActionMessage && <Toast message={apkActionMessage} tone="info" onClose={() => setApkActionMessage('')} />}
      <div className="kh-setup-release-actions">
        <button type="button" className="secondary-button" onClick={() => void checkApkRelease()} disabled={apkRelease.status === 'checking'}>{apkRelease.status === 'checking' ? 'Checking…' : 'Check for updates'}</button>
        <button type="button" className="kh-setup-release-primary" onClick={openLatestInCrownStore} disabled={!apkRelease.latestVersion || apkRelease.status === 'checking'}>{apkRelease.status === 'update' ? 'Update in CrownStore' : 'Open CrownStore'}</button>
      </div>
    </>;
    return <>
      {groups.map(group => <div className="kh-setup-type-group" key={group}><span className="kh-setup-group-label">{group}</span>{TYPE_OPTIONS.filter(option => option.group === group).map(option => <div className="kh-setup-setting-row" key={option.key}><div className="kh-setup-setting-copy"><strong>{option.label}</strong></div><Toggle checked={types[option.key]} onChange={value => updateType(option.key, value)} label={option.label} /></div>)}</div>)}
    </>;
  };
  const panels: { key: 'nowbar' | 'header' | 'channels' | 'types' | 'release'; title: string; summary: string; icon: string }[] = [
    { key: 'nowbar', title: 'Nowbar appearance', summary: nowbarEnabled ? 'Lighting on · ' + (LIGHT_STYLES.find(item => item.value === nowbarLight)?.label || 'Steady glow') + ' · ' + nowbarColor.toUpperCase() : 'Lighting off', icon: '◈' },
    { key: 'header', title: 'App header lighting', summary: headerEnabled ? 'Alert accent on · ' + headerColor.toUpperCase() : 'Alert accent off', icon: '✧' },
    { key: 'channels', title: 'Notification channels', summary: [channels.inApp && 'In-app', channels.push && 'Push', channels.email && 'Email'].filter(Boolean).join(' · ') || 'All channels off', icon: '♧' },
    { key: 'types', title: 'Notification types', summary: Object.values(types).filter(Boolean).length + ' of ' + TYPE_OPTIONS.length + ' alert types enabled', icon: '☷' },
    { key: 'release', title: 'Latest APK release', summary: apkRelease.status === 'update' ? 'Update available · v' + (apkRelease.latestVersion || '') : apkRelease.status === 'current' ? 'Latest installed · v' + (apkRelease.latestVersion || '') : apkRelease.status === 'latest' ? 'Download v' + (apkRelease.latestVersion || '') : apkRelease.status === 'checking' ? 'Checking latest version…' : 'APK version unavailable', icon: '↓' }
  ];
  return <section className="kh-setup-page kh-device-expanded" aria-labelledby="kh-setup-title">
    <div className="kh-setup-heading">
      <span className="eyebrow"><span className="eyebrow-line" />PERSONAL PREFERENCES</span>
      <h1 id="kh-setup-title">Device<span className="kh-setup-period">.</span></h1>
      <p>Manage your device experience and account alerts in one place.</p>
    </div>
    <div className="kh-device-settings-list">
      {panels.map(panel => <article className={'kh-device-setting-card' + (activePanel === panel.key ? ' is-open' : '')} key={panel.key}>
        <div className="kh-device-setting-summary">
          <span className="kh-setup-icon" aria-hidden="true">{panel.icon}</span>
          <div className="kh-device-setting-label"><h2>{panel.title}</h2><p>{panel.summary}</p></div>
<button type="button" className="secondary-button kh-device-menu-trigger" aria-label={(activePanel === panel.key ? 'Collapse ' : 'Expand ') + panel.title} aria-expanded={activePanel === panel.key} onClick={() => setActivePanel(current => current === panel.key ? null : panel.key)}><span aria-hidden="true">{activePanel === panel.key ? '−' : '+'}</span></button>
        </div>
        {activePanel === panel.key && <div className="kh-device-panel-inline">{panelContent(panel.key)}</div>}
      </article>)}
    </div>
    <div className="kh-setup-footer kh-device-footer"><span>{savedAt ? 'Saved ' + savedAt : 'Preferences save automatically on this device.'}</span><button type="button" className="secondary-button" onClick={() => { setNowbarEnabled(false); setNowbarColor('#b9c7df'); setNowbarLight('stable'); setButtonColorEnabled(false); setButtonColor('#b9c7df'); setHeaderEnabled(true); setHeaderColor('#b9c7df'); setChannels({ email: false, inApp: true, push: false }); setTypes({ signIns: true, security: true, identity: true, wallet: true, profile: true, systemUpdates: true }); setActivePanel(null); setNotice('Default preferences restored.'); }}>Restore defaults</button></div>
    {colorPicker === 'nowbar' && <ColorSelectionPage color={nowbarColor} title="Choose Nowbar colour" description="Choose the accent colour used by the Nowbar edge light and glow." onChange={setNowbarColor} onClose={() => setColorPicker(null)} />}
    {notice && <Toast message={notice} tone={notice.toLowerCase().includes('unavailable') || notice.toLowerCase().includes('unable') ? 'warning' : 'success'} onClose={() => setNotice('')} />}
    {colorPicker === 'button' && <ColorSelectionPage color={buttonColor} title="Choose Nowbar button colour" description="Choose the colour used for each individual navigation button border and glow." onChange={setButtonColor} onClose={() => setColorPicker(null)} />}
    {colorPicker === 'header' && <ColorSelectionPage color={headerColor} title="Choose header colour" description="Choose the accent colour used by the KingsHall app header lighting." onChange={setHeaderColor} onClose={() => setColorPicker(null)} />}
  </section>;
}
