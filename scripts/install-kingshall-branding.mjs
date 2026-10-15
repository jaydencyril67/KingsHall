import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = 'android/app/src/main/res';
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const fullIcon = 'public/kingshall-mark.svg';
const foreground = 'public/kingshall-foreground.svg';

for (const [density, size] of Object.entries(densities)) {
  const dir = path.join(root, 'mipmap-' + density);
  await mkdir(dir, { recursive: true });
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
    await sharp(fullIcon).resize(size, size).png().toFile(path.join(dir, name));
  }
  await sharp(foreground).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
}

const adaptiveDir = path.join(root, 'mipmap-anydpi-v26');
await mkdir(adaptiveDir, { recursive: true });
const adaptive = name => `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/kingshall_icon_background" />\n    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n`;
await writeFile(path.join(adaptiveDir, 'ic_launcher.xml'), adaptive('ic_launcher'), 'utf8');
await writeFile(path.join(adaptiveDir, 'ic_launcher_round.xml'), adaptive('ic_launcher_round'), 'utf8');

const valuesDir = path.join(root, 'values');
await mkdir(valuesDir, { recursive: true });
const colorsPath = path.join(valuesDir, 'colors.xml');
let colors = '';
try { colors = await (await import('node:fs/promises')).readFile(colorsPath, 'utf8'); } catch {}
if (!colors.includes('kingshall_icon_background')) {
  if (colors.includes('</resources>')) colors = colors.replace('</resources>', '    <color name="kingshall_icon_background">#000000</color>\n</resources>');
  else colors = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="kingshall_icon_background">#000000</color>\n</resources>\n';
  await writeFile(colorsPath, colors, 'utf8');
}
console.log('Installed KingsHall launcher icons from the custom SVG brand assets.');
