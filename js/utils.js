/* utils.js — tiny helpers shared by every module */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** True when the element is actually laid out (not display:none / inside a hidden panel). */
export const isVisible = (el) => !!el && el.offsetParent !== null;

/** Set textContent only when it changed (the UI is refreshed every animation frame). */
export function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

export class DeviceDetector {
  static get isMobile() {
    return window.innerWidth <= 768 || window.innerHeight > window.innerWidth;
  }
  static get isTouch() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
}

/** Number of decimals implied by a step, e.g. 0.05 -> 2, 10 -> 0. */
export function decimalsOf(step) {
  const text = String(step);
  return text.includes('.') ? text.split('.')[1].length : 0;
}

/** Format a number with fixed decimals, optional explicit "+" sign and unit. Non-numbers pass through. */
export function formatValue(value, { decimals = 3, unit = '', signed = false } = {}) {
  if (typeof value !== 'number') return String(value ?? '—');
  if (!Number.isFinite(value)) return '—';
  const sign = signed && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
}

/* ------------------------------------------------------------------ KaTeX helpers
   KaTeX is loaded with `defer` in index.html. If it failed to load (offline),
   everything falls back to showing the raw LaTeX text instead of crashing. */

/** Replace every $...$ in a string with rendered KaTeX HTML. */
export function mathToHtml(text) {
  if (typeof text !== 'string') return text;
  if (!window.katex) return text.replace(/\$([^$]+)\$/g, '$1'); // KaTeX unavailable: show plain LaTeX without the $ signs
  return text.replace(/\$([^$]+)\$/g, (match, tex) => {
    try {
      return window.katex.renderToString(tex, { throwOnError: false });
    } catch (_) {
      return match;
    }
  });
}

/** Render a LaTeX string into an element (display mode by default). */
export function renderLatex(el, latex, displayMode = true) {
  if (!el) return;
  if (window.katex) {
    try {
      window.katex.render(latex, el, { displayMode, throwOnError: false });
      return;
    } catch (_) { /* fall through */ }
  }
  el.textContent = latex;
}
