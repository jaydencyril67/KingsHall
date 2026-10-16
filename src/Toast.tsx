import { useEffect } from 'react';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';
type Props = { message: string; tone?: ToastTone; onClose: () => void; duration?: number };

const labels: Record<ToastTone, string> = {
  success: 'Success',
  error: 'Something went wrong',
  info: 'Notice',
  warning: 'Attention'
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  const paths: Record<ToastTone, string> = {
    success: 'm5 12 4 4L19 6',
    error: 'M12 8v5m0 3h.01M10.3 3.9 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z',
    info: 'M12 11v5m0-9h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    warning: 'M12 8v5m0 3h.01M10.3 3.9 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z'
  };
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[tone]} /></svg>;
}

export default function Toast({ message, tone = 'info', onClose, duration = 5500 }: Props) {
  useEffect(() => {
    if (!message || duration <= 0) return;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;
  return <div className={`kh-toast kh-toast-${tone}`} role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'} aria-live={tone === 'error' || tone === 'warning' ? 'assertive' : 'polite'}>
    <span className="kh-toast-icon"><ToastIcon tone={tone} /></span>
    <span className="kh-toast-copy"><strong>{labels[tone]}</strong><span>{message}</span></span>
    <button className="kh-toast-close" type="button" aria-label="Dismiss notification" onClick={onClose}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
  </div>;
}
