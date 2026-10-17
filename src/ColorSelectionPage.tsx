import { useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';

const validHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const hexToRgb = (hex: string) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('');
const hsvToHex = (hue: number, saturation: number, value: number) => {
  const chroma = value * saturation, segment = hue / 60, secondary = chroma * (1 - Math.abs(segment % 2 - 1));
  const [red, green, blue] = segment < 1 ? [chroma, secondary, 0] : segment < 2 ? [secondary, chroma, 0] : segment < 3 ? [0, chroma, secondary] : segment < 4 ? [0, secondary, chroma] : segment < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  const match = value - chroma;
  return rgbToHex(Math.round((red + match) * 255), Math.round((green + match) * 255), Math.round((blue + match) * 255));
};
const hueFromHex = (hex: string) => {
  const { r, g, b } = hexToRgb(hex), red = r / 255, green = g / 255, blue = b / 255;
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min;
  if (!delta) return 0;
  if (max === red) return (60 * ((green - blue) / delta) + 360) % 360;
  if (max === green) return 60 * ((blue - red) / delta + 2);
  return 60 * ((red - green) / delta + 4);
};

export default function ColorSelectionPage({ color, title, description, onChange, onClose }: { color: string; title: string; description: string; onChange: (color: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(color);
  const [rgb, setRgb] = useState(() => hexToRgb(color));
  const [hue, setHue] = useState(() => hueFromHex(color));
  const [saturation, setSaturation] = useState(() => { const c = hexToRgb(color), max = Math.max(c.r,c.g,c.b)/255, min = Math.min(c.r,c.g,c.b)/255; return max === 0 ? 0 : (max-min)/max; });
  const [value, setValue] = useState(() => Math.max(...Object.values(hexToRgb(color))) / 255);
  const [error, setError] = useState('');

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const choose = (next: string) => {
    if (!validHex(next)) return;
    const normalized = next.toLowerCase(), nextRgb = hexToRgb(normalized);
    const max = Math.max(nextRgb.r,nextRgb.g,nextRgb.b)/255, min = Math.min(nextRgb.r,nextRgb.g,nextRgb.b)/255;
    setDraft(normalized); setRgb(nextRgb); setHue(hueFromHex(normalized)); setValue(max); setSaturation(max === 0 ? 0 : (max-min)/max); setError('');
    onChange(normalized);
  };
  const chooseHue = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(), dx = event.clientX - (rect.left + rect.width/2), dy = event.clientY - (rect.top + rect.height/2);
    const distance = Math.hypot(dx,dy), radius = Math.min(rect.width,rect.height)/2;
    if (distance < radius - 24 || distance > radius) return;
    const nextHue = (Math.atan2(dy,dx)*180/Math.PI + 90 + 360)%360;
    setHue(nextHue); choose(hsvToHex(nextHue,saturation,value));
  };
  const chooseShade = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(), nextSaturation = Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)), nextValue = Math.max(0,Math.min(1,1-(event.clientY-rect.top)/rect.height));
    setSaturation(nextSaturation); setValue(nextValue); choose(hsvToHex(hue,nextSaturation,nextValue));
  };
  const updateRgb = (channel: 'r'|'g'|'b', raw: string) => {
    const next = { ...rgb, [channel]: Math.max(0,Math.min(255,Number(raw)||0)) };
    setRgb(next); choose(rgbToHex(next.r,next.g,next.b));
  };
  const buttonStyle: CSSProperties = { display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,minHeight:40,padding:'0 14px',border:'1px solid rgba(220,226,234,.16)',borderRadius:11,background:'rgba(255,255,255,.055)',color:'#f0f2f5',fontSize:12,fontWeight:700,cursor:'pointer' };

  return <div className="kh-color-page-backdrop">
    <header className="kh-color-page-header">
      <button type="button" className="kh-color-back" onClick={onClose} aria-label="Back to Setup"><span aria-hidden="true" className="kh-color-arrow">←</span></button>
      <div><strong>{title}</strong><span>COLOUR CUSTOMISATION</span></div>
      <button type="button" className="kh-color-header-done" onClick={onClose}>Done</button>
    </header>
    <main className="kh-color-page-content">
      <p className="kh-color-page-intro">{description} Your choice is saved immediately.</p>
      <section className="kh-color-current">
        <span className="kh-color-current-swatch" style={{background:draft,boxShadow:'0 0 25px '+draft}}/>
        <div><strong>Selected colour</strong><span>Live preview</span></div>
        <code>{draft.toUpperCase()}</code>
      </section>
      <section className="kh-color-wheel-card">
        <div className="kh-color-section-heading"><strong>Colour wheel</strong><span>Choose a hue, then adjust its shade</span></div>
        <div className="kh-color-picker">
          <div className="kh-color-hue-ring" onClick={chooseHue} role="group" aria-label="Colour hue wheel">
            <span className="kh-color-hue-track" style={{transform:'rotate('+hue+'deg)'}}><span/></span>
            <div className="kh-color-shade-field" style={{'--picker-hue':hsvToHex(hue,1,1) } as CSSProperties} onClick={event=>{event.stopPropagation();chooseShade(event)}}>
              <span style={{left:(saturation*100)+'%',top:((1-value)*100)+'%'}}/>
            </div>
          </div>
        </div>
        <div className="kh-color-hex-row">
          <input aria-label="HEX colour" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="#b9c7df" spellCheck={false}/>
          <button type="button" style={buttonStyle} onClick={()=>{const next=draft.startsWith('#')?draft:'#'+draft;if(!validHex(next)){setError('Enter a valid six-digit HEX colour, for example #b9c7df.');return;}choose(next);}}><span aria-hidden="true">✓</span> Apply</button>
        </div>
        <div className="kh-color-rgb-row">
          {(['r','g','b'] as const).map(channel=><label key={channel}>{channel.toUpperCase()}<input aria-label={channel.toUpperCase()+' colour value'} type="number" min="0" max="255" value={rgb[channel]} onChange={event=>updateRgb(channel,event.target.value)}/></label>)}
        </div>
        {error&&<p className="kh-color-error" role="alert">{error}</p>}
      </section>
      <p className="kh-color-save-note"><span/> Colour changes are applied as you choose them.</p>
    </main>
  </div>;
}
