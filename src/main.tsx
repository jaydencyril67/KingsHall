import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

function InitialSplashCleanup() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.getElementById('kh-refresh-splash')?.remove();
    }, 3000);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InitialSplashCleanup />
    <App />
  </React.StrictMode>
);
