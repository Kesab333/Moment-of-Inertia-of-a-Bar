/* ==========================================================================
   help.js — the "?" help modal: topic list on the left, numbered step cards
   and a tip on the right. Content comes from config.help.
   Closes with the × button, a click on the backdrop, or Escape; focus returns
   to the "?" button. Generic.
   ========================================================================== */

import { $, $$, mathToHtml } from './utils.js';

export function initHelp(config) {
  const topics = config.help ?? [];
  const overlay = $('#helpOverlay');
  const openButton = $('#helpButton');
  const closeButton = $('#closeHelpButton');
  const list = $('#faqQuestionList');
  const content = $('#faqProcedureContent');

  if (topics.length === 0) {
    openButton.hidden = true;
    return;
  }

  if (config.helpTitle) $('#helpTitle').textContent = config.helpTitle;
  if (config.helpSubtitle) $('#helpSubtitle').textContent = config.helpSubtitle;

  list.innerHTML = topics
    .map(
      (t, i) => `
      <li class="faq-q-item${i === 0 ? ' is-active' : ''}" data-topic="${t.id}" role="button" tabindex="0">
        <span class="q-number">${i + 1}</span>
        <span class="q-title">${t.question}</span>
      </li>`
    )
    .join('');

  function render(id) {
    const topic = topics.find((t) => t.id === id);
    if (!topic) return;

    content.innerHTML = `
      <div class="faq-content-header">
        <h3>${topic.title}</h3>
        <p class="faq-content-subtitle">${topic.subtitle ?? ''}</p>
      </div>
      <div class="faq-steps-list">
        ${topic.steps
          .map(
            (step, i) => `
          <div class="faq-step-card">
            <div class="step-badge">${i + 1}</div>
            <div class="step-body">
              <h4 class="step-title">${step.title}</h4>
              <p class="step-desc">${mathToHtml(step.desc)}</p>
            </div>
          </div>`
          )
          .join('')}
      </div>
      ${topic.tip ? `<div class="faq-callout-tip"><strong>Pro Tip:</strong> ${mathToHtml(topic.tip)}</div>` : ''}
    `;
    content.parentElement.scrollTop = 0;
  }

  function select(item) {
    $$('.faq-q-item', list).forEach((el) => el.classList.toggle('is-active', el === item));
    render(item.dataset.topic);
  }

  list.addEventListener('click', (event) => {
    const item = event.target.closest('.faq-q-item');
    if (item) select(item);
  });
  list.addEventListener('keydown', (event) => {
    const item = event.target.closest('.faq-q-item');
    if (item && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      select(item);
    }
  });

  function open() {
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // stop the page scrolling behind the modal
    const section = $('#workspaceCard').dataset.section;
    select($$('.faq-q-item', list).find(item => item.dataset.topic === section) ?? $('.faq-q-item', list));
    closeButton.focus();
  }

  function close() {
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    openButton.focus();
  }

  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !overlay.hidden) close(); });
}
