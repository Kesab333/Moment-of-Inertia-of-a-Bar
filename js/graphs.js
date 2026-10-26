/* ==========================================================================
   graphs.js — live oscillogram-style graphs on <canvas>

   initGraphs()    creates one <figure><canvas> per config.graphs entry
   renderGraphs()  redraws them from state.history (skips hidden canvases)
   drawGraph()     the reusable drawing routine:
                     - retina-sharp (devicePixelRatio aware)
                     - trailing time window anchored to the newest sample
                     - y-axis auto-grows past the default min/max
                     - line breaks where there is a recording gap
   Generic — series come from config.graphs.
   ========================================================================== */

import { $, clamp, isVisible } from './utils.js';

const canvases = new Map(); // graph id -> canvas

export function initGraphs(config) {
  const grid = $('#graphGrid');
  grid.innerHTML = (config.graphs ?? [])
    .map(
      (g) => `
      <figure>
        <figcaption>${g.title} <span class="graph-unit">(${g.unit ?? ''})</span></figcaption>
        <div class="graph-canvas-wrap"><canvas id="${g.id}" aria-label="${g.title} graph"></canvas></div>
      </figure>`
    )
    .join('');
  (config.graphs ?? []).forEach((g) => canvases.set(g.id, $(`#${g.id}`)));
}

export function renderGraphs(config, state) {
  (config.graphs ?? []).forEach((g) => {
    const canvas = canvases.get(g.id);
    if (!isVisible(canvas)) return; // panel hidden: nothing to draw
    drawGraph(canvas, { ...g, windowSeconds: config.graphWindowSeconds ?? 5 }, state.history);
  });
}

/** Match the canvas bitmap to its CSS size * devicePixelRatio. Returns CSS pixel size. */
function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);
  if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width: rect.width, height: rect.height, ratio };
}

/**
 * @param canvas  target <canvas>
 * @param opts    { color, min, max, get(sample) -> number, windowSeconds }
 *                min/max = smallest y-range to show (grows if data exceeds it)
 * @param history [{ time, ...values }] oldest -> newest
 */
export function drawGraph(canvas, opts, history) {
  const context = canvas.getContext('2d');
  const { width, height, ratio } = fitCanvas(canvas);
  if (!context || width <= 0 || height <= 0) return;

  const { color = '#168983', min = -1, max = 1, get, windowSeconds = 5 } = opts;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const pad = { left: 55, right: 15, top: 18, bottom: 28 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  /* ---- x window: the last `windowSeconds`, anchored to the newest sample ---- */
  const lastTime = history.length ? history[history.length - 1].time : 0;
  const startTime = Math.max(0, lastTime - windowSeconds);
  const span = Math.max(lastTime - startTime, windowSeconds);

  /* ---- y range: default min/max, grown to fit the visible data, plus 10 % headroom ---- */
  let lo = min;
  let hi = max;
  for (const point of history) {
    if (point.time < startTime) continue;
    const value = get(point);
    if (Number.isFinite(value)) {
      lo = Math.min(lo, value);
      hi = Math.max(hi, value);
    }
  }
  const headroom = (hi - lo || 1) * 0.1;
  lo -= headroom;
  hi += headroom;
  const range = Math.max(hi - lo, 1e-4);
  const yOf = (value) => pad.top + ((hi - clamp(value, lo, hi)) / range) * plotHeight;

  /* ---- grid + y labels ---- */
  context.font = '11px Nunito, sans-serif';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (i * plotHeight) / 4;
    context.strokeStyle = '#dce7e6';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    context.fillStyle = '#627070';
    context.fillText((hi - (i * range) / 4).toFixed(2), pad.left - 6, y);
  }

  /* ---- zero line (only if 0 is inside the range) ---- */
  if (lo < 0 && hi > 0) {
    context.strokeStyle = '#b6c4c3';
    context.beginPath();
    context.moveTo(pad.left, yOf(0));
    context.lineTo(width - pad.right, yOf(0));
    context.stroke();
  }

  /* ---- axes ---- */
  context.strokeStyle = '#607170';
  context.beginPath();
  context.moveTo(pad.left, pad.top);
  context.lineTo(pad.left, height - pad.bottom);
  context.lineTo(width - pad.right, height - pad.bottom);
  context.stroke();

  /* ---- x labels ---- */
  context.fillStyle = '#627070';
  context.textBaseline = 'top';
  context.textAlign = 'left';
  context.fillText(`${startTime.toFixed(1)}s`, pad.left, height - pad.bottom + 6);
  context.textAlign = 'right';
  context.fillText(`${(startTime + span).toFixed(1)}s`, width - pad.right, height - pad.bottom + 6);
  context.textAlign = 'center';
  context.fillText('time (s) →', pad.left + plotWidth / 2, height - pad.bottom + 6);

  if (history.length < 2) return;

  /* ---- data line ---- */
  context.beginPath();
  let started = false;
  let previousTime = null;
  for (const point of history) {
    if (point.time < startTime) continue;
    const value = get(point);
    if (!Number.isFinite(value)) continue;

    const x = pad.left + ((point.time - startTime) / span) * plotWidth;
    const y = yOf(value);
    const gap = previousTime !== null && point.time - previousTime > 0.5; // recording paused
    if (!started || gap) context.moveTo(x, y);
    else context.lineTo(x, y);
    started = true;
    previousTime = point.time;
  }
  if (started) {
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.lineJoin = 'round';
    context.stroke();
  }
}
