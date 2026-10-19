import { useEffect, useRef, useState, type FormEvent } from 'react';
import { alertsFetch } from './alertsClient';

type ApprovalResponse = {
  error?: string;
  message?: string;
  approved?: boolean;
  appName?: string;
  deviceLabel?: string;
};
type QrPayload = {
  type: 'kingshall-external-login-v1';
  requestId: string;
  qrToken: string;
  appName?: string;
};
type Barcode = { rawValue?: string };
type BarcodeDetectorLike = { detect(source: HTMLVideoElement): Promise<Barcode[]> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

function decodeExternalQr(value: string): QrPayload | null {
  try {
    const payload = JSON.parse(value) as Partial<QrPayload>;
    if (
      payload.type === 'kingshall-external-login-v1' &&
      typeof payload.requestId === 'string' &&
      /^[0-9a-f-]{36}$/i.test(payload.requestId) &&
      typeof payload.qrToken === 'string' &&
      payload.qrToken.length >= 32 &&
      payload.qrToken.length <= 200
    ) return payload as QrPayload;
  } catch {}
  return null;
}

export default function ExternalLoginPage() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [scanError, setScanError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const approvalInFlightRef = useRef(false);

  async function sendApproval(path: string, body: Record<string, string>) {
    if (approvalInFlightRef.current) return;
    approvalInFlightRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await alertsFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({})) as ApprovalResponse;
      if (!response.ok) throw new Error(data.error || data.message || 'The sign-in request could not be approved.');
      setCode('');
      setScanning(false);
      setScanError('');
      setNotice('Approved ' + (data.appName || 'the sign-in request') + (data.deviceLabel ? ' on ' + data.deviceLabel : '') + '. Return to that device; it will sign in automatically.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The sign-in request could not be approved.');
    } finally {
      approvalInFlightRef.current = false;
      setBusy(false);
    }
  }

  async function approveCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6 || busy) return;
    await sendApproval('/api/app-auth/external-login/approve-code', { code });
  }

  async function approveQr(requestId: string, qrToken: string) {
    await sendApproval('/api/app-auth/external-login/approve-qr', { requestId, qrToken });
  }

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    const setup = async () => {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!Detector) {
        setScanError('QR scanning is not supported by this browser. Enter the six-character code instead.');
        setScanning(false);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanError('Camera access is not available here. Enter the six-character code instead.');
        setScanning(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
        const video = videoRef.current;
        if (!video) { stream.getTracks().forEach(track => track.stop()); return; }
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ['qr_code'] });
        const scanFrame = async () => {
          if (stopped) return;
          try {
            const barcodes = await detector.detect(video);
            const rawValue = barcodes.find(item => typeof item.rawValue === 'string' && item.rawValue)?.rawValue;
            if (rawValue) {
              const payload = decodeExternalQr(rawValue);
              if (payload) {
                setScanning(false);
                setScanError('');
                void approveQr(payload.requestId, payload.qrToken);
                return;
              }
            }
          } catch {
            // Keep the preview running if a camera frame is temporarily unreadable.
          }
          if (!stopped) frame = window.requestAnimationFrame(() => { void scanFrame(); });
        };
        void scanFrame();
      } catch {
        setScanError('Could not open the camera. Allow camera access or enter the six-character code instead.');
        setScanning(false);
      }
    };
    setScanError('');
    void setup();
    return () => {
      stopped = true;
      if (frame) window.cancelAnimationFrame(frame);
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [scanning]);

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box' as const, minHeight: 50, borderRadius: 13,
    border: '1px solid var(--kh-card-primary-border, rgba(255,255,255,.2))',
    background: 'rgba(4,6,10,.36)', color: 'var(--kh-text-primary, #f3f4f6)',
    padding: '12px 14px', fontSize: 20, fontWeight: 800, letterSpacing: '.22em',
    textAlign: 'center' as const, textTransform: 'uppercase' as const, outline: 'none'
  };
  return <section className="kh-about-page" aria-labelledby="kh-external-login-title">
    <header className="kh-about-heading">
      <span className="eyebrow"><span className="eyebrow-line" />SECURE DEVICE APPROVAL</span>
      <h1 id="kh-external-login-title">External <em>Login.</em></h1>
      <p>Connect CryBots or HallsChat on another phone, tablet, or computer without signing in to KingsHall on that device. Approve with its one-time code or scan its QR code.</p>
    </header>
    <div className="kh-about-content">
      <div className="kh-about-info-grid">
    <article className="kh-about-info-card" style={{ display: 'grid', alignContent: 'start', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 15 }}>Approve with a login code</h3>
      <p className="kh-home-muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>Enter the six uppercase letters/numbers shown by CryBots or HallsChat. Only approve a request you started yourself.</p>
      <form onSubmit={approveCode} style={{ display: 'grid', gap: 10 }}>
        <label htmlFor="kh-external-login-code" style={{ fontSize: 12, fontWeight: 750 }}>One-time login code</label>
        <input
          id="kh-external-login-code"
          name="externalLoginCode"
          value={code}
          onChange={event => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setError(''); setNotice(''); }}
          maxLength={6}
          minLength={6}
          pattern="[A-Z0-9]{6}"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="A1B2C3"
          style={fieldStyle}
          required
        />
        <button className="submit-button" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Approving…' : 'Approve sign-in'}</button>
      </form>
    </article>
    <article className="kh-about-info-card" style={{ display: 'grid', alignContent: 'start', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Approve with QR code</h3>
          <p className="kh-home-muted" style={{ margin: '5px 0 0', fontSize: 12 }}>Point this device’s camera at the QR code on the sign-in screen.</p>
        </div>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => { setScanError(''); setScanning(value => !value); }}>{scanning ? 'Stop camera' : 'Scan QR code'}</button>
      </div>
      {scanning && <div style={{ overflow: 'hidden', borderRadius: 14, border: '1px solid rgba(255,255,255,.18)', background: '#050505' }}>
        <video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview for scanning a KingsHall external login QR code" style={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'cover' }} />
        <p className="kh-home-muted" style={{ padding: '0 12px 12px', margin: 0, fontSize: 12 }}>Hold the QR code steady inside the camera view.</p>
      </div>}
      {scanError && <p role="status" className="kh-home-muted" style={{ margin: 0, fontSize: 12 }}>{scanError}</p>}
    </article>
      </div>
    {error && <p role="alert" style={{ marginTop: 14, padding: 12, borderRadius: 12, border: '1px solid rgba(220,80,80,.34)', background: 'rgba(220,60,60,.09)', color: 'var(--kh-text-primary, #f3f4f6)', fontSize: 13 }}>{error}</p>}
    {notice && <p role="status" style={{ marginTop: 14, padding: 12, borderRadius: 12, border: '1px solid rgba(160,190,220,.25)', background: 'rgba(160,190,220,.07)', color: 'var(--kh-text-primary, #f3f4f6)', fontSize: 13, lineHeight: 1.55 }}>{notice}</p>}
    <p className="kh-home-muted" style={{ marginTop: 16, fontSize: 11, lineHeight: 1.6 }}>Each request expires automatically after five minutes and can be approved only once. Your KingsHall session stays on this device; the target device receives only its CryBots or HallsChat session.</p>
    </div>
  </section>;
}
