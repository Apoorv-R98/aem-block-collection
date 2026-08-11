import { readBlockConfig } from '../../scripts/aem.js';

async function fetchMockAnswer() {
  const url = `${window.hlx.codeBasePath}/blocks/content-ai-search/mock-answer.json`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to load mock answer: ${resp.status}`);
  }
  return resp.json();
}

function renderAnswer(container, data, disclaimerText) {
  container.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'cmp-content-ai-search__summary-card';

  const header = document.createElement('div');
  header.className = 'cmp-content-ai-search__summary-header';
  header.textContent = 'Generative Answer';
  panel.append(header);

  const text = document.createElement('div');
  text.className = 'cmp-content-ai-search__summary-text';
  text.textContent = data.result || '';
  panel.append(text);

  const hits = data.hits || [];
  if (hits.length) {
    const sources = document.createElement('div');
    sources.className = 'cmp-content-ai-search__sources';

    const label = document.createElement('span');
    label.className = 'cmp-content-ai-search__sources-label';
    label.textContent = 'Sources';
    sources.append(label);

    hits.forEach((hit) => {
      const meta = hit.metadata || {};
      // The live Content AI API returns { metadata: { url } } with no
      // "title"/"source" fields (those only exist in this block's mock
      // fixture, mock-answer.json) — fall back to the URL as both the
      // link target and the visible label instead of the raw hex hit id.
      // Confirmed live 2026-08-11 (GRANITE-71249).
      const href = meta.url || meta.source || '#';
      const link = document.createElement('a');
      link.className = 'cmp-content-ai-search__source-chip';
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = meta.title || href || hit.id || 'Source';
      sources.append(link);
    });

    panel.append(sources);
  }

  container.append(panel);

  if (disclaimerText) {
    const disclaimer = document.createElement('p');
    disclaimer.className = 'cmp-content-ai-search__disclaimer';
    disclaimer.textContent = disclaimerText;
    container.append(disclaimer);
  }
}

function showLoading(container) {
  container.innerHTML = '';
  const loading = document.createElement('p');
  loading.className = 'cmp-content-ai-search__loading';
  loading.textContent = 'Generating answer…';
  container.append(loading);
}

function showError(container, message) {
  container.innerHTML = '';
  const error = document.createElement('p');
  error.className = 'cmp-content-ai-search__error';
  error.textContent = message;
  container.append(error);
}

export default function decorate(block) {
  const config = readBlockConfig(block);
  const placeholder = config.placeholder || 'Ask a question…';
  const { id } = config;
  const toggleVisible = config['gen-search-toggle-visible'] !== 'false';
  const enabledByDefault = config['gen-search-enabled-by-default'] !== 'false';
  const errorFallback = config['gen-search-error-fallback']
    || 'Sorry, we could not generate an answer. Please try again.';
  const disclaimerText = config['disclaimer-text'] || '';

  block.innerHTML = '';
  block.classList.add('cmp-content-ai-search');
  if (id) block.id = id;

  const form = document.createElement('form');
  form.className = 'cmp-content-ai-search__form';
  form.setAttribute('role', 'search');

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'cmp-content-ai-search__input';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', placeholder);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'cmp-content-ai-search__submit';
  submit.textContent = 'Ask';

  form.append(input, submit);

  const summaryEl = document.createElement('div');
  summaryEl.className = 'cmp-content-ai-search__summary';
  summaryEl.setAttribute('role', 'status');
  summaryEl.setAttribute('aria-live', 'polite');

  let toggleInput;
  let toggleWrap;
  if (toggleVisible) {
    toggleWrap = document.createElement('label');
    toggleWrap.className = 'cmp-content-ai-search__toggle';

    toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = enabledByDefault;

    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Show generative summary';

    toggleWrap.append(toggleInput, toggleLabel);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    const summaryOn = toggleInput ? toggleInput.checked : enabledByDefault;
    if (!summaryOn) {
      summaryEl.innerHTML = '';
      return;
    }

    showLoading(summaryEl);
    try {
      const data = await fetchMockAnswer();
      renderAnswer(summaryEl, data, disclaimerText);
    } catch (error) {
      showError(summaryEl, errorFallback);
    }
  });

  block.append(form);
  if (toggleWrap) block.append(toggleWrap);
  block.append(summaryEl);
}
