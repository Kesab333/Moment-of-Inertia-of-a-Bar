/* ==========================================================================
   results.js — Results panel: readout grid + optional bar.
   config.results    = [{ label, unit, decimals, signed, get(state) }]
   config.resultsBar = { label, unit, decimals, get(state), full(state) }   (optional)
   Generic.
   ========================================================================== */

import { $, $$, clamp, formatValue, setText } from './utils.js';

let nodes = [];

export function initResults(config) {
  $('#readoutGrid').innerHTML = (config.results ?? [])
    .map((r) => `<p>${r.label} <strong data-result>—</strong></p>`)
    .join('');
  nodes = $$('#readoutGrid [data-result]');

  const bar = config.resultsBar;
  $('#meterBar').hidden = !bar;
  if (bar) setText($('#meterLabel'), bar.label);
}

export function renderResults(config, state) {
  (config.results ?? []).forEach((r, i) => {
    setText(nodes[i], formatValue(r.get(state), r));
  });

  const bar = config.resultsBar;
  if (!bar) return;
  const value = bar.get(state);
  setText($('#meterValue'), formatValue(value, bar));
  const percent = clamp((value / (bar.full(state) || 1)) * 100, 0, 100);
  $('#meterFill').style.width = `${percent}%`;
}
