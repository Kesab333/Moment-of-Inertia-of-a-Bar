/* ==========================================================================
   observation.js — Observation panel: live sentence + readings table.
   config.observationText(state) -> string
   config.readingsTable = { title, columns:[{key,label,format}], emptyText, highlightKey }
   Generic.
   ========================================================================== */

import { $, setText } from './utils.js';

let lastKey = null;

export function initObservation(config) {
  const table = config.readingsTable;
  if (!table) return;
  setText($('#readingsHeading'), table.title ?? 'Recorded readings');
  $('#readingsHead').innerHTML =
    `<tr><th>#</th>${table.columns.map((c) => `<th>${c.label}</th>`).join('')}</tr>`;
}

export function renderObservation(config, state) {
  setText($('#observationText'), config.observationText ? config.observationText(state) : '');

  const table = config.readingsTable;
  if (!table) return;

  // The table only changes when a reading is added/removed or the mode changes
  const last = state.readings[state.readings.length - 1];
  const key = `${state.mode}|${state.readings.length}|${last ? last.time : ''}`;
  if (key === lastKey) return;
  lastKey = key;

  const body = $('#readingsBody');
  const span = table.columns.length + 1;

  if (state.readings.length === 0) {
    const message = typeof table.emptyText === 'function' ? table.emptyText(state) : (table.emptyText ?? 'No readings yet.');
    body.innerHTML = `<tr><td class="empty-row" colspan="${span}">${message}</td></tr>`;
    return;
  }

  let max = -Infinity;
  let min = Infinity;
  if (table.highlightKey) {
    state.readings.forEach((row) => {
      max = Math.max(max, row[table.highlightKey]);
      min = Math.min(min, row[table.highlightKey]);
    });
  }

  body.innerHTML = state.readings
    .map((row, index) => {
      const cells = table.columns
        .map((col) => {
          const raw = row[col.key];
          let text = col.format ? col.format(raw, row, state) : raw;
          if (table.highlightKey === col.key && state.readings.length > 1) {
            if (raw === max) text += ' <b class="badge-max">[MAX]</b>';
            else if (raw === min) text += ' <b class="badge-min">[MIN]</b>';
          }
          const sign = table.highlightKey === col.key ? (raw >= 0 ? 'positive-reading' : 'negative-reading') : '';
          return `<td class="${sign}">${text}</td>`;
        })
        .join('');
      return `<tr><td>${index + 1}</td>${cells}</tr>`;
    })
    .join('');
}
