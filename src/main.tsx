import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

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

registerKingsHallPwa();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InitialSplashCleanup />
    <App />
  </React.StrictMode>
);
