/**
 * Minimal Code 128 (Code Set B) renderer → SVG markup string. No external dependency.
 *
 * Code Set B covers ASCII 32–127 (digits, upper/lowercase, common punctuation) which is
 * sufficient for retail SKUs/barcodes. For purely numeric codes Code 128C would be denser,
 * but B keeps the encoder simple and scans identically on any reader.
 */

// Bar/space width patterns for values 0–106. Each is 6 modules (bar,space,...) except the
// stop code (106) which is 7. This is the canonical Code 128 symbology table.
const PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const STOP = 106;

/** Returns the module-width string for the full barcode of `value`. */
function encode(value: string): string {
  const codes: number[] = [START_B];
  let checksum = START_B;
  for (let i = 0; i < value.length; i++) {
    const v = value.charCodeAt(i) - 32;
    if (v < 0 || v > 94) continue; // skip out-of-range chars
    codes.push(v);
    checksum += v * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(STOP);
  return codes.map((c) => PATTERNS[c]).join('');
}

/**
 * Render `value` as a Code 128 SVG string. `height` is the bar height in px; the overall
 * width is derived from the module count × `moduleWidth`.
 */
export function barcodeSvg(
  value: string,
  opts: { height?: number; moduleWidth?: number } = {},
): string {
  const height = opts.height ?? 48;
  const mw = opts.moduleWidth ?? 1.6;
  const widths = encode(value);
  let x = 0;
  let isBar = true;
  const rects: string[] = [];
  for (const ch of widths) {
    const w = Number(ch) * mw;
    if (isBar) {
      rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="#000"/>`);
    }
    x += w;
    isBar = !isBar;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x.toFixed(2)}" height="${height}" viewBox="0 0 ${x.toFixed(2)} ${height}" preserveAspectRatio="none">${rects.join('')}</svg>`;
}
