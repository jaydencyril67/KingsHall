import { useEffect, useRef, useState, type TouchEvent, type CSSProperties } from 'react';

type Section = 'HOME' | 'IDENTITY' | 'DEVICE' | 'SECURITY' | 'UPDATES' | 'ABOUT' | 'EXIT';
type Props = { section: string; onNavigate: (section: 'HOME' | 'IDENTITY' | 'DEVICE' | 'SECURITY' | 'ABOUT') => void; onExit: () => void };

const actions: { label: Section; icon: string }[] = [
  { label: 'HOME', icon: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6' },
  { label: 'IDENTITY', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' },
  { label: 'DEVICE', icon: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM10 18h4' },
  { label: 'SECURITY', icon: 'M12 3 19 6v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6zM9 12l2 2 4-4' },
  { label: 'UPDATES', icon: 'M20 7v5h-5M4 17v-5h5M5.6 9A7 7 0 0 1 17 6l3 6M4 12l3 6a7 7 0 0 0 11.4-3' },
  { label: 'ABOUT', icon: 'M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  { label: 'EXIT', icon: 'M10 4H5v16h5M14 8l4 4-4 4M8 12h10' },
];

const STORAGE_KEY = 'kingshall-nowbar-action';
const ORDER: Section[] = ['HOME'];

export default function NowBar({ section, onNavigate }: Props) {
  const [appearance, setAppearance] = useState(() => ({
    enabled: localStorage.getItem('kh_nowbar_color_enabled') === 'true',
    color: /^#[0-9a-f]{6}$/i.test(localStorage.getItem('kh_nowbar_color') || '') ? localStorage.getItem('kh_nowbar_color')! : '#b9c7df',
    light: localStorage.getItem('kh_nowbar_light_style') || 'stable'
  }));
  useEffect(() => {
    const syncAppearance = () => setAppearance({
      enabled: localStorage.getItem('kh_nowbar_color_enabled') === 'true',
      color: /^#[0-9a-f]{6}$/i.test(localStorage.getItem('kh_nowbar_color') || '') ? localStorage.getItem('kh_nowbar_color')! : '#b9c7df',
      light: localStorage.getItem('kh_nowbar_light_style') || 'stable'
    });
    window.addEventListener('kh:nowbar-color-changed', syncAppearance);
    window.addEventListener('storage', syncAppearance);
    return () => { window.removeEventListener('kh:nowbar-color-changed', syncAppearance); window.removeEventListener('storage', syncAppearance); };
  }, []);
  const [view, setView] = useState<'title' | 'actions'>('title');
  const [mode, setMode] = useState<'compact' | 'expanded'>('compact');
  const [pressing, setPressing] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const holdTimer = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);
  const holdTriggered = useRef(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeHandled = useRef(false);

  const stopHold = () => {
    setPressing(false);
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const resetIdle = () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      setView('title');
      setMode('compact');
    }, 10000);
  };

  const startHold = () => {
    holdTriggered.current = false;
    setPressing(true);
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      holdTriggered.current = true;
      setView('actions');
      setMode(current => current === 'compact' ? 'expanded' : 'compact');
      resetIdle();
    }, 700);
  };

  useEffect(() => {
    if (view !== 'actions' || mode !== 'compact' || !barRef.current) return;
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(STORAGE_KEY); } catch {}
    const target = Array.from(barRef.current.querySelectorAll<HTMLButtonElement>('[data-nowbar-label]'))
      .find(button => button.dataset.nowbarLabel === saved);
    if (!target) return;
    const centerTarget = () => {
      if (!barRef.current) return;
      const max = barRef.current.scrollWidth - barRef.current.clientWidth;
      const left = target.offsetLeft - (barRef.current.clientWidth - target.offsetWidth) / 2;
      barRef.current.scrollLeft = Math.max(0, Math.min(left, max));
    };
    centerTarget();
    const frame = window.requestAnimationFrame(centerTarget);
    return () => window.cancelAnimationFrame(frame);
  }, [view, mode]);

  useEffect(() => () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
  }, []);

  const activate = (label: Section) => {
    try { window.localStorage.setItem(STORAGE_KEY, label); } catch {}
    resetIdle();
    if (label !== 'HOME' && label !== 'IDENTITY' && label !== 'DEVICE' && label !== 'SECURITY' && label !== 'ABOUT') return;
    if (label === section) {
      setView('title');
      setMode('compact');
      return;
    }
    setView('title');
    setMode('compact');
    onNavigate(label);
  };

  const finishSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    const index = ORDER.indexOf((section === 'EXIT' ? 'HOME' : section) as Section);
    const next = ORDER[index + (dx < 0 ? 1 : -1)];
    if (next !== 'HOME') return;
    swipeHandled.current = true;
    onNavigate('HOME');
    setView('title');
    setMode('compact');
    resetIdle();
  };

  return (
    <div className={`kh-nowbar-dock ${mode === 'expanded' ? 'is-expanded' : ''} kh-nowbar-light-${appearance.light}`} style={{ '--kh-nowbar-accent': appearance.enabled ? appearance.color : 'transparent', '--kh-nowbar-glow': appearance.enabled ? appearance.color + '66' : 'transparent' } as CSSProperties}>
      <div
        ref={barRef}
        className={`kh-nowbar ${view === 'title' ? 'is-title' : 'is-actions'} ${mode === 'expanded' ? 'is-expanded' : ''}`}
        role="group"
        aria-label="KingsHall quick navigation"
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onTouchStart={event => {
          startHold();
          const titleTarget = (event.target as HTMLElement).closest('.kh-nowbar-title');
          if (titleTarget && event.touches.length === 1) swipeStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }}
        onTouchEnd={event => {
          stopHold();
          if ((event.target as HTMLElement).closest('.kh-nowbar-title')) finishSwipe(event);
        }}
        onTouchCancel={() => { stopHold(); swipeStart.current = null; }}
      >
        <div className="kh-nowbar-rail" />
        {view === 'title' ? (
          <button
            className={`kh-nowbar-title ${pressing ? 'is-pressing' : ''}`}
            type="button"
            aria-label={`${section} page. Tap to show navigation buttons; hold to expand; swipe to navigate.`}
            onClick={() => {
              if (swipeHandled.current) { swipeHandled.current = false; return; }
              if (holdTriggered.current) { holdTriggered.current = false; return; }
              setView(current => current === 'title' ? 'actions' : 'title');
              setMode('compact');
              resetIdle();
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setView(current => current === 'title' ? 'actions' : 'title');
                setMode('compact');
                resetIdle();
              }
            }}
          >
            <span className="kh-nowbar-orb" />
            <span className="kh-nowbar-current">{section}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
          </button>
        ) : (
          <div className={`kh-nowbar-actions ${mode === 'expanded' ? 'is-expanded' : 'is-compact'}`} aria-label="Navigation buttons">
            {actions.map(action => (
              <div className={`kh-nowbar-slot ${mode === 'expanded' ? 'is-expanded' : ''}`} key={action.label}>
                <button
                  data-nowbar-label={action.label}
                  className={`kh-nowbar-action ${action.label === section ? 'is-active' : ''} ${action.label === 'EXIT' ? 'is-exit' : ''}`}
                  type="button"
                  aria-label={action.label}
                  onClick={() => {
                    if (holdTriggered.current) { holdTriggered.current = false; return; }
                    if (action.label === 'HOME' || action.label === 'IDENTITY' || action.label === 'DEVICE' || action.label === 'SECURITY' || action.label === 'ABOUT') activate(action.label);
                  }}
                >
                  <span className="kh-nowbar-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={action.icon} /></svg></span>
                  {mode === 'compact' && <span className="kh-nowbar-label-compact">{action.label}</span>}
                  {mode === 'expanded' && <span className="kh-nowbar-label-expanded">{action.label.length > 12 ? <span className="kh-nowbar-marquee">{action.label.toUpperCase()} · {action.label.toUpperCase()}</span> : action.label}</span>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
