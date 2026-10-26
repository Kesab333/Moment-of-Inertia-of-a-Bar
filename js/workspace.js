/* ==========================================================================
   workspace.js — navigation + section (panel) switching

   - buildNav()        sidebar icons from config.sections
   - initWorkspace()   show one <section class="panel"> at a time, update the
                       title, the side panel mode and the dashboard <-> workspace state
   - initFullscreen()  page fullscreen + viewport-only fullscreen
   Generic — nothing here is experiment-specific.
   ========================================================================== */

import { $, $$, mathToHtml } from './utils.js';

export function buildNav(sections) {
  // A url() inside a CSS custom property is resolved relative to the stylesheet that
  // *uses* var(--icon) (css/layout.css), not the page. Making it absolute avoids that trap.
  const absolute = (path) => new URL(path, document.baseURI).href;

  $('#navMenu').innerHTML = sections
    .map(
      (s) => `
      <li class="tool-list">
        <button class="nav-btn workspace-link" type="button" data-workspace="${s.id}"
                aria-label="${s.title}" style="--icon:url('${absolute(s.icon)}')"></button>
        <span>${s.title}</span>
      </li>`
    )
    .join('');
}

export function initWorkspace(config, { onChange } = {}) {
  const { sections } = config;
  const card = $('#workspaceCard');
  const title = $('#workspaceTitle');
  const sideInfo = $('#sideInfo');
  const panels = new Map(sections.map((s) => [s.id, $(`#panel-${s.id}`)]));

  sections.forEach((s) => {
    if (!panels.get(s.id)) console.warn(`[lab] config.sections has "${s.id}" but index.html has no #panel-${s.id}`);
  });

  /* Side panel: controls for interactive sections, info card (or nothing) for the rest */
  function renderSidePanel(section) {
    if (section.interactive) {
      card.dataset.side = 'on';
      return;
    }
    const info = config.sideInfo?.[section.id];
    if (!info) {
      card.dataset.side = 'off';
      sideInfo.innerHTML = '';
      return;
    }
    card.dataset.side = 'on';
    sideInfo.innerHTML = `
      <details class="side-details" open>
        <summary><span>${info.title}</span></summary>
        <ul class="side-info-list">
          ${info.items.map((i) => `<li><strong>${mathToHtml(i.label)}:</strong> ${mathToHtml(i.text)}</li>`).join('')}
        </ul>
      </details>`;
  }

  function setActiveNav(id) {
    $$('.workspace-link').forEach((button) => {
      const active = button.dataset.workspace === id;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function show(id) {
    const section = sections.find((s) => s.id === id);
    if (!section) return;

    document.body.classList.remove('dashboard-active');
    $$('.panel').forEach((panel) => { panel.hidden = panel !== panels.get(id); });

    card.dataset.section = id;
    card.dataset.interactive = String(Boolean(section.interactive));
    title.textContent = section.heading || section.title;
    setActiveNav(id);
    renderSidePanel(section);
    window.scrollTo({ top: 0 });
    if (onChange) onChange(id);
  }

  function showDashboard() {
    document.body.classList.add('dashboard-active');
    setActiveNav(null);
    if (onChange) onChange(null);
  }

  $$('.workspace-link').forEach((button) => button.addEventListener('click', () => show(button.dataset.workspace)));
  $('#dashboardCloseBtn').addEventListener('click', showDashboard);

  /* Accordion: only one of Controls / Variables open at a time */
  const controlsCard = $('#controlsCard');
  const variablesCard = $('#variablesCard');
  controlsCard.addEventListener('toggle', () => { if (controlsCard.open) variablesCard.open = false; });
  variablesCard.addEventListener('toggle', () => { if (variablesCard.open) controlsCard.open = false; });

  return { show, showDashboard };
}

export function initFullscreen() {
  const pageButton = $('#fullscreenButton');
  const viewportButton = $('#viewportFullscreenButton');
  const simWindow = $('#simulationWindow');

  pageButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) { /* denied / unsupported: ignore */ }
  });

  viewportButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (simWindow.requestFullscreen) await simWindow.requestFullscreen();
      else if (simWindow.webkitRequestFullscreen) await simWindow.webkitRequestFullscreen(); // older Safari
    } catch (error) {
      console.error('Could not enter viewport full mode:', error);
    }
  });

  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = Boolean(document.fullscreenElement);
    pageButton.textContent = isFullscreen ? '⊡' : '⛶';
    viewportButton.classList.toggle('is-active', isFullscreen);
    viewportButton.title = isFullscreen ? 'Exit viewport full mode' : 'Full viewport mode';
    window.dispatchEvent(new Event('resize')); // lets the canvas re-measure itself
  });
}
