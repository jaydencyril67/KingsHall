import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { listenForNativeLaunchUrls } from './utils/crossAppLauncher';

function InitialSplashCleanup() {
  useEffect(() => {
    let timeout: number | undefined;
    let firstFrame: number | undefined;
    let secondFrame: number | undefined;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        timeout = window.setTimeout(() => {
          document.getElementById('kh-refresh-splash')?.remove();
        }, 3000);
      });
    });

    return () => {
      if (firstFrame !== undefined) window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) window.cancelAnimationFrame(secondFrame);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, []);

  return null;
}

function registerKingsHallPwa() {
  // The service worker is for the HTTPS website/PWA, not the Capacitor APK.
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    window.location.protocol !== 'https:' ||
    window.location.hostname === 'localhost'
  ) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => registration.update())
      .catch((error) => console.warn('KingsHall PWA service worker registration failed:', error));
  }, { once: true });
}

function handleNativeKingsHallLaunch(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'kingshall:' || url.hostname !== 'signin') return;
    const app = url.searchParams.get('app') || '';
    if (app !== 'crybots' && app !== 'hallschat') return;
    const returnTo = url.searchParams.get('returnTo') || '';
    const params = new URLSearchParams({ app });
    if (returnTo) params.set('returnTo', returnTo);
    const query = params.toString();
    const route = '/signin' + (query ? '?' + query : '');
    window.history.replaceState({}, '', route);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch {
    // Ignore unrelated or malformed Android launch intents.
  }
}

listenForNativeLaunchUrls(handleNativeKingsHallLaunch);

registerKingsHallPwa();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InitialSplashCleanup />
    <App />
  </React.StrictMode>
);
