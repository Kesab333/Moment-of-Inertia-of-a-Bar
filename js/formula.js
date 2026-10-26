/* ==========================================================================
   formula.js — Formula panel: a dropdown of formulas, each showing
   usage text, the rendered LaTeX and a variables list.
   Data comes from config.formulas. Generic.
   ========================================================================== */

import { $, mathToHtml, renderLatex } from './utils.js';

export function initFormulas(config) {
  const formulas = config.formulas ?? [];
  const select = $('#formulaSelect');
  const usage = $('#formulaUsage');
  const latex = $('#formulaLatex');
  const variables = $('#formulaVariables');

  select.innerHTML = formulas.map((f) => `<option value="${f.id}">${f.name}</option>`).join('');

  function show(id) {
    const formula = formulas.find((f) => f.id === id);
    if (!formula) return;

    usage.innerHTML = mathToHtml(formula.usage);
    renderLatex(latex, formula.latex, true);
    variables.innerHTML = formula.variables
      .map(
        (v) => `
        <li>
          <span class="var-symbol">${mathToHtml(`$${v.symbol}$`)}</span>
          <span class="var-desc">${mathToHtml(v.desc)}</span>
        </li>`
      )
      .join('');
  }

  select.addEventListener('change', (event) => show(event.target.value));
  if (formulas.length) show(formulas[0].id);
}
