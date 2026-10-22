import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeAppUpdate } from './utils/nativeAppUpdate';
import { openCrownStoreApp } from './utils/crownStore';
import { alertsFetch } from './alertsClient';

type UpdateCheckResponse = {
  updateAvailable: boolean;
  installedVersion?: string;
  latestVersion?: string;
  releaseNotes?: string;
};

export default function AppUpdateMonitor() {
  const [update, setUpdate] = useState<UpdateCheckResponse | null>(null);
  const [hidden, setHidden] = useState(false);
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
      if (data.updateAvailable && data.latestVersion) {
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

  const startUpdate = () => {
    if (!update?.latestVersion) return;
    openCrownStoreApp('kingshall', setMessage);
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
        <button type="button" className="kh-app-update-primary" onClick={startUpdate}>
          <span aria-hidden="true">↗</span> Open CrownStore to update
        </button>
        <button type="button" className="kh-app-update-later" onClick={() => setHidden(true)}>Later</button>
      </div>
    </aside>
  );
}
