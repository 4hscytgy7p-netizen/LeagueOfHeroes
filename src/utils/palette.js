// Simple palette helper: apply/load/save user palette to CSS variables
// This is a lightweight utility intended to be used by a client-side UI.

const STORAGE_KEY = 'lh_user_palette_v1';

export function applyPalette(palette = {}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(palette).forEach(([key, value]) => {
    // Expect keys like '--primary', '--link', etc.
    try {
      root.style.setProperty(key, value);
    } catch (e) {
      // ignore invalid keys
    }
  });
}

export function savePalette(palette = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
  } catch (e) {
    console.error('Failed to save palette', e);
  }
}

export function loadPalette() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load palette', e);
    return null;
  }
}

// Basic generator: given an accent color (hex), derive a few related vars
export function generateFromAccent(accentHex) {
  const hsl = hexToHsl(accentHex);
  if (!hsl) return null;
  const { h, s, l } = hsl;
  const primary = accentHex;
  const primaryDark = hslToHex(h, Math.max(20, s - 6), Math.max(8, l - 18));
  const link = accentHex;
  const linkVisited = hslToHex(h, Math.max(10, s - 10), Math.max(18, l - 28));
  const linkHover = hslToHex(h, Math.min(100, s + 6), Math.min(95, l + 18));

  return {
    '--primary': primary,
    '--primary-dark': primaryDark,
    '--link': link,
    '--link-visited': linkVisited,
    '--link-hover': linkHover,
  };
}

// Helpers: convert hex <-> hsl (lightweight)
function hexToHsl(hex) {
  if (!hex) return null;
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  if (Number.isNaN(bigint)) return null;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const rP = r / 255;
  const gP = g / 255;
  const bP = b / 255;
  const max = Math.max(rP, gP, bP);
  const min = Math.min(rP, gP, bP);
  let h, s;
  let l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rP: h = (gP - bP) / d + (gP < bP ? 6 : 0); break;
      case gP: h = (bP - rP) / d + 2; break;
      case bP: h = (rP - gP) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s = s / 100; l = l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r=0,g=0,b=0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return `#${toHex(R)}${toHex(G)}${toHex(B)}`;
}

function toHex(v) {
  const s = v.toString(16);
  return s.length === 1 ? '0' + s : s;
}
