import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeAppUpdate } from './utils/nativeAppUpdate';
import { alertsFetch } from './alertsClient';

type UpdateCheckResponse = {
  updateAvailable: boolean;
  installedVersion?: string;
  latestVersion?: string;
  downloadUrl?: string;
  releaseNotes?: string;
  releaseUrl?: string;
};

export default function AppUpdateMonitor() {
  const [update, setUpdate] = useState<UpdateCheckResponse | null>(null);
  const [hidden, setHidden] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState('');

  const checkForUpdate = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    try {
      const appInfo = await NativeAppUpdate.getAppInfo();
      if (!appInfo?.versionName) return;
      const query = '?installedVersion=' + encodeURIComponent(appInfo.versionName);
      const response = await alertsFetch('/api/notifications/app-update-check' + query, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as UpdateCheckResponse;
      if (data.updateAvailable && data.downloadUrl && data.latestVersion) {
        setUpdate(data);
        setHidden(false);
      } else {
        setUpdate(null);
      }
    } catch {
      // Update checks are best-effort and must never interrupt normal KingsHall use.
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    void checkForUpdate();
    const interval = window.setInterval(() => { void checkForUpdate(); }, 15 * 60 * 1000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('kh:app-update-check-now', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('kh:app-update-check-now', refreshWhenVisible);
    };
  }, [checkForUpdate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android' || !NativeAppUpdate.addListener) return;
    let listener: { remove: () => Promise<void> } | undefined;
    void NativeAppUpdate.addListener('downloadError', event => {
      setInstalling(false);
      setMessage(event.message || 'The KingsHall APK download or installer could not complete.');
    }).then(handle => { listener = handle; }).catch(() => {});
    return () => { if (listener) void listener.remove(); };
  }, []);

  const startUpdate = async () => {
    if (!update?.downloadUrl || installing) return;
    setInstalling(true);
    setMessage('Preparing the KingsHall update…');
    try {
      const result = await NativeAppUpdate.downloadAndInstall({ url: update.downloadUrl });
      if (result.requiresPermission) {
        setInstalling(false);
        setMessage('Allow KingsHall to install unknown apps in Android settings, return here, then tap Update now again.');
      } else {
        setMessage('The APK is downloading. Android will ask you to approve the update when it finishes.');
      }
    } catch {
      setInstalling(false);
      setMessage('The in-app installer could not start. Opening the signed APK download in your browser.');
      window.open(update.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!update || hidden || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null;

  return (
    <aside className="kh-app-update-notice" role="status" aria-live="polite">
      <div className="kh-app-update-heading">
        <span className="kh-app-update-mark" aria-hidden="true">↓</span>
        <div className="kh-app-update-copy">
          <strong>KingsHall update available</strong>
          <p>Version {update.latestVersion} is ready. Update without uninstalling KingsHall.</p>
        </div>
        <button type="button" className="kh-app-update-close" onClick={() => setHidden(true)} aria-label="Dismiss update notice">×</button>
      </div>
      {update.releaseNotes && <details className="kh-app-update-notes"><summary>Release notes</summary><p>{update.releaseNotes}</p></details>}
      {message && <p className="kh-app-update-message" role="status" aria-live="polite">{message}</p>}
      <div className="kh-app-update-actions">
        {installing ? (
          <div className="kh-app-update-progress" role="status" aria-live="polite"><span className="kh-app-update-spinner" aria-hidden="true" /> Download starting…</div>
        ) : (
          <button type="button" className="kh-app-update-primary" onClick={() => void startUpdate()}>
            <span aria-hidden="true">↓</span> Update now
          </button>
        )}
        <button type="button" className="kh-app-update-later" onClick={() => setHidden(true)}>Later</button>
      </div>
    </aside>
  );
}
