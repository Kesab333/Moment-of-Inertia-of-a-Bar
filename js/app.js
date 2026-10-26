/* ==========================================================================
   app.js — entry point. Builds the UI from config, owns the model + scene,
   and runs the main loop:

        model.update(fixed dt)  ->  render(state)  ->  requestAnimationFrame

   Nothing experiment-specific lives here: edit config.js / physics.js / scene.js.
   ========================================================================== */

import { LAB } from './config.js';
import { ExperimentModel, GEO } from './physics.js';
import { $, isVisible, renderLatex } from './utils.js';
import { buildNav, initWorkspace, initFullscreen } from './workspace.js';
import { buildControls, bindControls, syncControl, renderControls } from './controls.js';
import { initDashboard } from './dashboard.js';

import { initFormulas } from './formula.js';
import { initCalculation } from './calculation.js';
import { initObservation, renderObservation } from './observation.js';
import { initResults, renderResults } from './results.js';
import { initHelp } from './help.js';

/* ---- Integration settings ----
   FIXED_DT          physics runs in fixed steps so results don't depend on frame rate
   PHYSICS_SUB_STEPS raise this (e.g. 8–16) if your equations are stiff / unstable */
const FIXED_DT = 1 / 120;
const PHYSICS_SUB_STEPS = 1;

/* ------------------------------------------------------------------ 1. Static page bits */
document.title = `${LAB.title} | SOLVE Virtual Lab`;
$('#labTitle').textContent = LAB.title;
$('#labLogo').src = LAB.logo;
$('#footerText').textContent = LAB.footer;
if (LAB.diagram) {
  $('#diagramImage').src = LAB.diagram.image;
  $('#diagramImage').alt = LAB.diagram.alt ?? '';
  $('#diagramCaption').textContent = LAB.diagram.caption ?? '';
}

/* ------------------------------------------------------------------ 2. Model + UI */
const model = new ExperimentModel(LAB);

buildNav(LAB.sections);
const controlRefs = buildControls(LAB);
// the model moves sliders itself (e.g. when the bar is re-hung by hand)
model.onSync = (name, value) => syncControl(controlRefs, name, value, { force: true });

initFormulas(LAB);
initCalculation(LAB);
initObservation(LAB);
initResults(LAB);
initHelp(LAB);

/* ------------------------------------------------------------------ 3. 3D scene (optional)
   Loaded lazily so a Three.js / WebGL failure never takes the rest of the lab down. */
const simViewport = $('#simViewport');
let scene = null;

async function loadScene() {
  try {
    const { LabScene } = await import('./scene.js');
    scene = new LabScene(simViewport, { model });
    window.__lab = { model, scene };   // handy for debugging in the console
    model.onMessage = (text, kind) => scene && scene.toast(text, kind);
    mountScene();
    scene.resize();
  } catch (error) {
    console.warn('[lab] 3D scene unavailable:', error);
    simViewport.innerHTML =
      '<p class="viewport-fallback">The 3D view could not be loaded (Three.js or WebGL is unavailable). The rest of the experiment still works.</p>';
  }
}
loadScene();

/* ------------------------------------------------------------------ 4. Navigation */
const workspace = initWorkspace(LAB, {
  onChange: () => requestAnimationFrame(() => { mountScene(); if (scene) { scene.resize(); scene.setView('overview', true); } const select = $('#viewSelect'); if (select) select.value = 'overview'; })
});
initDashboard(LAB.sections, { onOpen: workspace.show });
const formulaPreview = document.createElement('div');
formulaPreview.className = 'dashboard-formula-preview';
formulaPreview.setAttribute('aria-hidden', 'true');
if (window.katex) renderLatex(formulaPreview, LAB.formulas.find(f => f.id === 'period').latex);
else formulaPreview.textContent = 'T = 2π √(I / mgl)';
document.querySelector('[data-section="formula"] .dash-preview-content').replaceChildren(formulaPreview);
initFullscreen();
const previewHost = document.createElement('div'); previewHost.className = 'dashboard-live-scene';
document.querySelector('[data-section="simulation"] .dash-preview-content').replaceChildren(previewHost);
function mountScene() {
  if (!scene) return;
  const dashboard = document.body.classList.contains('dashboard-active');
  (dashboard ? previewHost : $('#simulationWindow')).append(simViewport);
}
$('#viewSelect').addEventListener('change', e => scene?.setView(e.target.value));
mountScene();
window.addEventListener('resize', () => scene && scene.resize());

/* ------------------------------------------------------------------ 5. Controls -> model */
function setParameter(name, value, commit = false) {
  const applied = model.setParameter(name, value);
  syncControl(controlRefs, name, applied, { force: commit });
}

bindControls(controlRefs, {
  onParameter: (name, value, commit) => {
    // a rejected change (e.g. pin is out) must snap the slider back
    const before = model.parameters[name];
    const applied = model.setParameter(name, value);
    syncControl(controlRefs, name, applied, { force: commit || applied === before || controlRefs[name]?.def.snap });
  },
  onToggle: (id, enabled) => model.setToggle(id, enabled),
  onExtra: (id) => LAB.extraButtons?.find((b) => b.id === id)?.run(model),
  onStart: () => model.start(),
  onPause: () => model.toggleRun(),
  onReset: () => model.reset()
});

/* ------------------------------------------------------------------ 6. Render */
const panels = {
  simulation: $('#panel-simulation'),
  observation: $('#panel-observation'),
  results: $('#panel-results')
};

let previewAt = 0;
function render() {
  const state = model.state;
  renderControls(LAB, state);

  const dashboardVisible = document.body.classList.contains('dashboard-active');
  if (dashboardVisible && performance.now() - previewAt > 500) {
    previewAt = performance.now();
    renderObservation(LAB, state); renderResults(LAB, state);
    LAB.sections.filter(s => s.id !== 'simulation' && s.id !== 'formula').forEach(s => {
      const source = document.querySelector(`#panel-${s.id}`);
      const target = document.querySelector(`[data-section="${s.id}"] .dash-preview-content`);
      if (!source || !target) return;
      const clone = source.cloneNode(true); clone.hidden = false; clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
      clone.querySelectorAll('input, select, button').forEach(e => { e.tabIndex = -1; });
      const wrapper = document.createElement('div'); wrapper.className = 'dashboard-panel-preview'; wrapper.setAttribute('aria-hidden', 'true'); wrapper.append(clone); target.replaceChildren(wrapper);
    });
  }
  // Only touch panels the user can currently see
  if (isVisible(panels.observation)) renderObservation(LAB, state);
  if (isVisible(panels.results)) renderResults(LAB, state);

  const holes = model.holeList();
  for (const [name, min, max] of [['slide', holes[0], holes[holes.length - 1]], ['l', model.lMin(), model.lMax()], ['gateY', GEO.gateMin, model.gateMax()]]) {
    const ref = controlRefs[name];
    for (const input of [ref.slider, ref.number]) { input.min = min.toFixed(6); input.max = max.toFixed(6); }
  }
  syncControl(controlRefs, 'gateY', state.values.gateY);
  syncControl(controlRefs, 'pin', state.values.pinOut);
  $('#cgReadout').textContent = `Centre of gravity from one end, L/2 = ${(state.values.L / 2).toFixed(3)} m`;
  if (scene && (document.body.classList.contains('dashboard-active') || isVisible(panels.simulation))) scene.update(state);
}

/* ------------------------------------------------------------------ 7. Main loop */
let lastFrame = performance.now();
let accumulator = 0;

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1); // clamp: a background tab must not "catch up" in one jump
  lastFrame = now;

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    for (let i = 0; i < PHYSICS_SUB_STEPS; i += 1) model.update(FIXED_DT / PHYSICS_SUB_STEPS);
    accumulator -= FIXED_DT;
  }

  render();
  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(frame);
