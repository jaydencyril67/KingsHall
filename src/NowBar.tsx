import { useEffect, useRef, useState } from 'react';

type Section = 'HOME' | 'IDENTITY' | 'APPS' | 'SECURITY' | 'PROFILE' | 'HELP' | 'EXIT';
type Props = { section: Section; onNavigate: (section: Exclude<Section, 'EXIT'>) => void; onExit: () => void };

const actions: { label: Section; icon: string }[] = [
  { label: 'HOME', icon: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6' },
  { label: 'IDENTITY', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' },
  { label: 'APPS', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  { label: 'SECURITY', icon: 'M12 3 19 6v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6zM9 12l2 2 4-4' },
  { label: 'PROFILE', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' },
  { label: 'HELP', icon: 'M9.5 9a2.6 2.6 0 1 1 4.7 1.5c-1.1 1.2-2.2 1.4-2.2 3M12 17.5v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  { label: 'EXIT', icon: 'M10 4H5v16h5M14 8l4 4-4 4M8 12h10' },
];

const STORAGE_KEY = 'kingshall-nowbar-action';

export default function NowBar({ section, onNavigate, onExit }: Props) {
  const [view, setView] = useState<'title' | 'actions'>('title');
  const [expanded, setExpanded] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const holdTimer = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);
  const holdTriggered = useRef(false);

  const resetIdle = () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      setView('title');
      setExpanded(false);
    }, 10000);
  };

  const stopHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const startHold = () => {
    holdTriggered.current = false;
    stopHold();
    holdTimer.current = window.setTimeout(() => {
      holdTriggered.current = true;
      setView('actions');
      setExpanded(value => !value);
      resetIdle();
    }, 700);
  };

  useEffect(() => {
    if (view !== 'actions' || expanded || !barRef.current) return;
    let target: HTMLButtonElement | undefined;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      target = Array.from(barRef.current.querySelectorAll<HTMLButtonElement>('button[data-nowbar-label]'))
        .find(button => button.dataset.nowbarLabel === saved);
    } catch {}
    if (target) target.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [view, expanded]);

  useEffect(() => () => {
    stopHold();
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
  }, []);

  const activate = (label: Section) => {
    try { window.localStorage.setItem(STORAGE_KEY, label); } catch {}
    resetIdle();
    if (label === 'EXIT') { onExit(); return; }
    setView('title');
    setExpanded(false);
    onNavigate(label);
  };

  return (
    <div className={`kh-nowbar-dock ${expanded && view === 'actions' ? 'is-expanded' : ''}`}>
      <div
        ref={barRef}
        className={`kh-nowbar ${view === 'title' ? 'is-title' : 'is-actions'} ${expanded && view === 'actions' ? 'is-expanded' : ''}`}
        role="group"
        aria-label="KingsHall navigation"
      >
        {view === 'title' ? (
          <button
            className="kh-nowbar-title"
            type="button"
            aria-label={`${section} page. Tap to show navigation buttons; hold to expand.`}
            onPointerDown={startHold}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onClick={() => {
              if (holdTriggered.current) { holdTriggered.current = false; return; }
              setView('actions');
              setExpanded(false);
              resetIdle();
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setView('actions');
                resetIdle();
              }
            }}
          >
            <span className="kh-nowbar-orb" />
            <span className="kh-nowbar-current">{section}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
          </button>
        ) : (
          <div className="kh-nowbar-actions" aria-label="Navigation buttons">
            {actions.map(action => (
              <button
                key={action.label}
                data-nowbar-label={action.label}
                className={`kh-nowbar-action ${section === action.label ? 'is-active' : ''} ${action.label === 'EXIT' ? 'is-exit' : ''}`}
                type="button"
                aria-label={action.label}
                onClick={() => activate(action.label)}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={action.icon} /></svg>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
