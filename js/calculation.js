/* ==========================================================================
   calculation.js — Calculation panel: number inputs + step-by-step working.
   config.calculation = { inputs:[…], steps:[{ key,title,latex,substitute,compute,unit,digits }] }
   Each step can read the inputs `v` and the results of earlier steps `r`.
   Generic.
   ========================================================================== */

import { $, $$ } from './utils.js';

function tex(latex) {
  if (!window.katex) return `<code>${latex}</code>`;
  try {
    return window.katex.renderToString(latex, { displayMode: true, throwOnError: false });
  } catch (_) {
    return `<code>${latex}</code>`;
  }
}

export function initCalculation(config) {
  const calc = config.calculation;
  if (!calc) return;

  $('#calcInputs').innerHTML = calc.inputs
    .map(
      (i) => `
      <label>${i.label}
        <input type="number" data-calc="${i.id}" value="${i.value}"
               ${i.step !== undefined ? `step="${i.step}"` : ''}
               ${i.min !== undefined ? `min="${i.min}"` : ''}
               ${i.max !== undefined ? `max="${i.max}"` : ''}>
      </label>`
    )
    .join('');

  function render() {
    const v = {};
    $$('#calcInputs [data-calc]').forEach((input) => {
      const def = calc.inputs.find((i) => i.id === input.dataset.calc);
      const n = Number(input.value);
      v[def.id] = input.value.trim() !== '' && Number.isFinite(n) ? n : def.value;
    });

    const r = {};
    $('#calcSteps').innerHTML = calc.steps
      .map((step) => {
        let value;
        let working = '';
        try {
          value = step.compute(v, r);
          r[step.key] = value;
          const shown = Number.isFinite(value) ? value.toFixed(step.digits ?? 3) : '—';
          working = `${step.substitute(v, r)} = \\mathbf{${shown}\\ \\text{${step.unit ?? ''}}}`;
        } catch (_) {
          working = '\\text{cannot be calculated for these inputs}';
        }
        return `
          <div class="calc-step">
            <div class="calc-step-title">${step.title}</div>
            <div class="calc-step-latex">${tex(step.latex)}${tex(working)}</div>
          </div>`;
      })
      .join('');
  }

  $('#calcInputs').addEventListener('input', render);
  render();
}
