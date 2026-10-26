/* ==========================================================================
   dashboard.js — first-screen card grid (one card per config.sections entry)
   A card shows `section.preview` (any HTML) or, by default, a large icon.
   To get a live preview, put a <canvas> or <img> in `preview` and animate it
   from your own code. Generic.
   ========================================================================== */

import { $, $$ } from './utils.js';

export function initDashboard(sections, { onOpen } = {}) {
  const view = $('#dashboardView');

  view.innerHTML = `
    <div class="dashboard-cards-grid">
      ${sections
        .map(
          (s, i) => `
        <div class="dash-preview-card" data-section="${s.id}" tabindex="0" role="button"
             aria-label="Open ${s.title}" style="--card-accent:${s.accent ?? 'var(--clr-primary)'}; --i:${i}">
          <div class="dash-preview-area">
            <div class="dash-preview-content">
              ${s.preview ?? `<div class="dash-default-preview"><img src="${s.icon}" alt="" draggable="false"></div>`}
            </div>
            <div class="dash-preview-badge" title="${s.title}">
              <img src="${s.icon}" alt="" class="dash-icon-img" draggable="false">
            </div>
          </div>
          <div class="dash-card-label"><span>${s.title}</span></div>
        </div>`
        )
        .join('')}
    </div>`;

  $$('.dash-preview-card', view).forEach((card) => {
    const open = () => onOpen && onOpen(card.dataset.section);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}
