import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

function InitialSplashCleanup() {
  useEffect(() => {
    let timeout: number | undefined;
    let firstFrame: number | undefined;
    let secondFrame: number | undefined;

    // Start the 3-second clock only after the splash has had a chance to paint.
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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InitialSplashCleanup />
    <App />
  </React.StrictMode>
);
