import { readBlockConfig } from '../../scripts/aem.js';

const LOADING_DISPLAY_DELAY = 300;
const TAB_RESULTS = 'search-results';
const TAB_AI = 'ai-mode';

async function fetchMockAnswer() {
  const url = `${window.hlx.codeBasePath}/blocks/content-ai-search/mock-answer.json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load mock answer: ${resp.status}`);
  return resp.json();
}

async function fetchMockResults() {
  const url = `${window.hlx.codeBasePath}/blocks/content-ai-search/mock-results.json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load mock results: ${resp.status}`);
  return resp.json();
}

async function fetchSearchAnswer(baseUrl, contentSource, contentSourceType, query) {
  const url = `${baseUrl}/adobe/experimental/aemcontentai-expires-20261231/contentAI/content-sources/gensearch`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentSource: { name: contentSource, type: contentSourceType },
      query,
    }),
  });
  if (!resp.ok) throw new Error(`Content AI request failed: ${resp.status}`);
  return resp.json();
}

async function fetchSearchResults(baseUrl, contentSource, contentSourceType, query, size, cursor) {
  const url = `${baseUrl}/adobe/experimental/aemcontentai-expires-20261231/contentAI/content-sources/search`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentSource: { name: contentSource, type: contentSourceType },
      query: { type: 'vector', text: query, options: { size } },
      ...(cursor ? { cursor } : {}),
    }),
  });
  if (!resp.ok) throw new Error(`Content AI search failed: ${resp.status}`);
  return resp.json();
}

function toggleShow(el, show) {
  if (!el) return;
  if (show !== false) el.removeAttribute('hidden');
  else el.setAttribute('hidden', 'hidden');
}

function setCookie(name, value) {
  const oneYearSeconds = 365 * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${oneYearSeconds}; SameSite=Lax; Secure`;
}

function resolveMetadataUrl(meta) {
  return (meta && (meta.url || meta.source)) || '';
}

function renderResultItem(item, layout) {
  const meta = item.metadata || {};
  const title = meta.title || resolveMetadataUrl(meta) || item.id || 'Untitled';
  const description = meta.description || '';
  const image = meta.image || '';
  const href = resolveMetadataUrl(meta) || '#';

  const li = document.createElement('li');
  li.className = 'cmp-content-ai-search__item';

  const link = document.createElement('a');
  link.className = layout === 'list' ? 'cmp-content-ai-search__row' : 'cmp-content-ai-search__card';
  link.href = href;

  if (image) {
    const img = document.createElement('img');
    img.className = layout === 'list' ? 'cmp-content-ai-search__row-image' : 'cmp-content-ai-search__card-image';
    img.src = image;
    img.alt = '';
    img.loading = 'lazy';
    link.append(img);
  }

  const body = document.createElement('div');
  body.className = layout === 'list' ? 'cmp-content-ai-search__row-body' : 'cmp-content-ai-search__card-body';

  const titleEl = document.createElement('h3');
  titleEl.className = layout === 'list' ? 'cmp-content-ai-search__row-title' : 'cmp-content-ai-search__card-title';
  titleEl.textContent = title;
  body.append(titleEl);

  if (description) {
    const descriptionEl = document.createElement('p');
    descriptionEl.className = layout === 'list' ? 'cmp-content-ai-search__row-description' : 'cmp-content-ai-search__card-description';
    descriptionEl.textContent = description;
    body.append(descriptionEl);
  }

  link.append(body);
  li.append(link);
  return li;
}

function renderSourceChip(hit) {
  const meta = hit.metadata || {};
  const href = resolveMetadataUrl(meta);
  const label = meta.title || href || hit.id || 'Source';

  const li = document.createElement('li');
  const chip = document.createElement(href ? 'a' : 'span');
  chip.className = 'cmp-content-ai-search__source-chip';
  chip.textContent = label;
  if (href) {
    chip.href = href;
    chip.target = '_blank';
    chip.rel = 'noopener';
  }
  li.append(chip);
  return li;
}

export default function decorate(block) {
  const config = readBlockConfig(block);
  const placeholder = config.placeholder || 'Search…';
  const { id } = config;
  const aiSearchModeEnabled = config['ai-search-mode-enabled'] !== 'false';
  const genSearchErrorRetryVisible = config['gen-search-error-retry-visible'] !== 'false';
  const disclaimerText = config['disclaimer-text'] || '';
  const baseUrl = config['base-url'] || '';
  const contentSource = config['content-source'] || '';
  const contentSourceType = config['content-source-type'] || 'AEM_PUBLISH';
  const resultsSize = parseInt(config['results-size'], 10) || 10;
  let resultsLayout = config['results-layout'] === 'list' ? 'list' : 'card';

  block.innerHTML = '';
  block.classList.add('cmp-content-ai-search', `cmp-content-ai-search--${resultsLayout}`);
  if (id) block.id = id;

  const form = document.createElement('form');
  form.className = 'cmp-content-ai-search__form';
  form.setAttribute('role', 'search');

  const field = document.createElement('div');
  field.className = 'cmp-content-ai-search__field';

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'cmp-content-ai-search__input';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', placeholder);

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'cmp-content-ai-search__clear';
  clearButton.setAttribute('aria-label', 'Clear');
  clearButton.textContent = '×';
  clearButton.hidden = true;

  field.append(input, clearButton);
  form.append(field);

  let tabs;
  let tabResultsBtn;
  let tabAiBtn;
  let panelAi;
  let summaryLoading;
  let summaryEl;
  let summaryText;
  let sourcesEl;
  let errorEl;
  let retryButton;

  if (aiSearchModeEnabled) {
    tabs = document.createElement('div');
    tabs.className = 'cmp-content-ai-search__tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Search mode');

    tabResultsBtn = document.createElement('button');
    tabResultsBtn.type = 'button';
    tabResultsBtn.setAttribute('role', 'tab');
    tabResultsBtn.className = 'cmp-content-ai-search__tab';
    tabResultsBtn.setAttribute('aria-selected', 'true');
    tabResultsBtn.textContent = 'Search Results';

    tabAiBtn = document.createElement('button');
    tabAiBtn.type = 'button';
    tabAiBtn.setAttribute('role', 'tab');
    tabAiBtn.className = 'cmp-content-ai-search__tab';
    tabAiBtn.setAttribute('aria-selected', 'false');
    tabAiBtn.tabIndex = -1;
    tabAiBtn.textContent = 'AI Mode';

    tabs.append(tabResultsBtn, tabAiBtn);

    panelAi = document.createElement('div');
    panelAi.className = 'cmp-content-ai-search__panel';
    panelAi.setAttribute('role', 'tabpanel');
    panelAi.hidden = true;

    summaryLoading = document.createElement('div');
    summaryLoading.className = 'cmp-content-ai-search__summary-loading';
    summaryLoading.setAttribute('aria-live', 'polite');
    summaryLoading.hidden = true;
    summaryLoading.innerHTML = '<div class="cmp-content-ai-search__summary-card">'
      + '<div class="cmp-content-ai-search__summary-loading-content">'
      + '<span class="cmp-content-ai-search__summary-loading-indicator" aria-hidden="true"></span>'
      + '<p class="cmp-content-ai-search__summary-loading-text">Generating answer…</p>'
      + '</div></div>';

    summaryEl = document.createElement('div');
    summaryEl.className = 'cmp-content-ai-search__summary';
    summaryEl.setAttribute('role', 'status');
    summaryEl.setAttribute('aria-live', 'polite');
    summaryEl.hidden = true;

    const summaryCard = document.createElement('div');
    summaryCard.className = 'cmp-content-ai-search__summary-card';

    const summaryHeader = document.createElement('div');
    summaryHeader.className = 'cmp-content-ai-search__summary-header';
    summaryHeader.innerHTML = '<span class="cmp-content-ai-search__summary-icon" aria-hidden="true"></span>'
      + '<div class="cmp-content-ai-search__summary-heading">'
      + '<p class="cmp-content-ai-search__summary-title">Generative answer</p>'
      + '<p class="cmp-content-ai-search__summary-attribution">Powered by Content AI</p>'
      + '</div>';

    summaryText = document.createElement('p');
    summaryText.className = 'cmp-content-ai-search__summary-text';

    const sourcesSection = document.createElement('div');
    sourcesSection.className = 'cmp-content-ai-search__sources-section';
    const sourcesLabel = document.createElement('p');
    sourcesLabel.className = 'cmp-content-ai-search__sources-label';
    sourcesLabel.textContent = 'Sources';
    sourcesEl = document.createElement('ul');
    sourcesEl.className = 'cmp-content-ai-search__sources';
    sourcesSection.append(sourcesLabel, sourcesEl);

    summaryCard.append(summaryHeader, summaryText, sourcesSection);

    if (disclaimerText) {
      const disclaimer = document.createElement('p');
      disclaimer.className = 'cmp-content-ai-search__disclaimer';
      disclaimer.textContent = disclaimerText;
      summaryCard.append(disclaimer);
    }

    summaryEl.append(summaryCard);

    errorEl = document.createElement('div');
    errorEl.className = 'cmp-content-ai-search__error';
    errorEl.hidden = true;
    const errorMessage = document.createElement('p');
    errorMessage.textContent = 'Something went wrong generating the summary.';
    errorEl.append(errorMessage);
    if (genSearchErrorRetryVisible) {
      retryButton = document.createElement('button');
      retryButton.type = 'button';
      retryButton.textContent = 'Try again';
      errorEl.append(retryButton);
    }

    panelAi.append(summaryLoading, summaryEl, errorEl);
  }

  const panelResults = document.createElement('div');
  panelResults.className = 'cmp-content-ai-search__panel';
  if (aiSearchModeEnabled) panelResults.setAttribute('role', 'tabpanel');

  const resultsSection = document.createElement('div');
  resultsSection.className = 'cmp-content-ai-search__results-section';
  resultsSection.hidden = true;

  const resultsToolbar = document.createElement('div');
  resultsToolbar.className = 'cmp-content-ai-search__results-toolbar';

  const layoutToggle = document.createElement('div');
  layoutToggle.className = 'cmp-content-ai-search__layout-toggle';
  layoutToggle.setAttribute('role', 'group');
  layoutToggle.setAttribute('aria-label', 'Results layout');

  const layoutCardBtn = document.createElement('button');
  layoutCardBtn.type = 'button';
  layoutCardBtn.className = 'cmp-content-ai-search__layout-btn';
  layoutCardBtn.textContent = 'Cards';

  const layoutListBtn = document.createElement('button');
  layoutListBtn.type = 'button';
  layoutListBtn.className = 'cmp-content-ai-search__layout-btn';
  layoutListBtn.textContent = 'List';

  layoutToggle.append(layoutCardBtn, layoutListBtn);
  resultsToolbar.append(layoutToggle);

  const resultsList = document.createElement('ul');
  resultsList.className = 'cmp-content-ai-search__results';
  resultsList.setAttribute('aria-label', 'Search results');

  const loadMoreButton = document.createElement('button');
  loadMoreButton.type = 'button';
  loadMoreButton.className = 'cmp-content-ai-search__load-more';
  loadMoreButton.textContent = 'Load more results';
  loadMoreButton.hidden = true;

  resultsSection.append(resultsToolbar, resultsList, loadMoreButton);
  panelResults.append(resultsSection);

  block.append(form);
  if (aiSearchModeEnabled) {
    block.append(tabs, panelAi, panelResults);
  } else {
    block.append(panelResults);
  }

  let activeTab = TAB_RESULTS;
  let allResults = [];
  let nextCursor = null;
  let currentQuery = '';
  let resultsRequestId = 0;
  let genSearchRequestId = 0;

  function syncLayoutButtons() {
    layoutCardBtn.setAttribute('aria-pressed', resultsLayout === 'list' ? 'false' : 'true');
    layoutListBtn.setAttribute('aria-pressed', resultsLayout === 'list' ? 'true' : 'false');
  }

  function applyLayoutClass() {
    block.classList.remove('cmp-content-ai-search--card', 'cmp-content-ai-search--list');
    block.classList.add(resultsLayout === 'list' ? 'cmp-content-ai-search--list' : 'cmp-content-ai-search--card');
  }

  function renderResults() {
    resultsList.innerHTML = '';
    if (!allResults.length) {
      resultsSection.hidden = true;
      loadMoreButton.hidden = true;
      return;
    }
    allResults.forEach((item) => resultsList.append(renderResultItem(item, resultsLayout)));
    resultsSection.hidden = false;
    loadMoreButton.hidden = !nextCursor;
  }

  function clearResults() {
    currentQuery = '';
    allResults = [];
    nextCursor = null;
    resultsRequestId += 1;
    genSearchRequestId += 1;
    resultsList.innerHTML = '';
    resultsSection.hidden = true;
    loadMoreButton.hidden = true;
    if (summaryEl) summaryEl.hidden = true;
    if (summaryLoading) summaryLoading.hidden = true;
    if (errorEl) errorEl.hidden = true;
  }

  async function runResultsSearch(query, cursor, append) {
    resultsRequestId += 1;
    const requestId = resultsRequestId;
    try {
      const data = baseUrl
        ? await fetchSearchResults(
          baseUrl,
          contentSource,
          contentSourceType,
          query,
          resultsSize,
          cursor,
        )
        : await fetchMockResults();
      if (requestId !== resultsRequestId) return;
      const results = data.results || [];
      allResults = append ? allResults.concat(results) : results;
      nextCursor = data.cursor || null;
      renderResults();
    } catch (error) {
      if (requestId !== resultsRequestId) return;
      if (!append) {
        allResults = [];
        nextCursor = null;
        renderResults();
      }
    }
  }

  async function runGenSearch(query) {
    if (!summaryEl) return;
    genSearchRequestId += 1;
    const requestId = genSearchRequestId;
    const start = Date.now();
    if (errorEl) errorEl.hidden = true;
    summaryEl.hidden = true;
    summaryLoading.hidden = false;
    try {
      const data = baseUrl
        ? await fetchSearchAnswer(baseUrl, contentSource, contentSourceType, query)
        : await fetchMockAnswer();
      const elapsed = Date.now() - start;
      setTimeout(() => {
        if (requestId !== genSearchRequestId) return;
        summaryLoading.hidden = true;
        summaryText.textContent = data.result || '';
        sourcesEl.innerHTML = '';
        (data.hits || []).forEach((hit) => sourcesEl.append(renderSourceChip(hit)));
        summaryEl.hidden = false;
      }, Math.max(0, LOADING_DISPLAY_DELAY - elapsed));
    } catch (error) {
      const elapsed = Date.now() - start;
      setTimeout(() => {
        if (requestId !== genSearchRequestId) return;
        summaryLoading.hidden = true;
        if (errorEl) errorEl.hidden = false;
      }, Math.max(0, LOADING_DISPLAY_DELAY - elapsed));
    }
  }

  function runQuery(query) {
    if (!query) {
      currentQuery = '';
      clearResults();
      return;
    }
    currentQuery = query;
    runResultsSearch(query, null, false);
    if (aiSearchModeEnabled) runGenSearch(query);
  }

  function activateTab(tab) {
    if (tab === activeTab) return;
    activeTab = tab;
    const showAi = tab === TAB_AI;
    tabAiBtn.setAttribute('aria-selected', showAi ? 'true' : 'false');
    tabAiBtn.tabIndex = showAi ? 0 : -1;
    tabResultsBtn.setAttribute('aria-selected', showAi ? 'false' : 'true');
    tabResultsBtn.tabIndex = showAi ? -1 : 0;
    toggleShow(panelAi, showAi);
    toggleShow(panelResults, !showAi);
    setCookie('cmp-content-ai-search-tab', tab);
  }

  if (aiSearchModeEnabled) {
    tabResultsBtn.addEventListener('click', () => activateTab(TAB_RESULTS));
    tabAiBtn.addEventListener('click', () => activateTab(TAB_AI));
    [tabResultsBtn, tabAiBtn].forEach((btn) => btn.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const next = activeTab === TAB_RESULTS ? TAB_AI : TAB_RESULTS;
      activateTab(next);
      (next === TAB_AI ? tabAiBtn : tabResultsBtn).focus();
    }));
    if (retryButton) {
      retryButton.addEventListener('click', () => runGenSearch(currentQuery));
    }
  }

  layoutCardBtn.addEventListener('click', () => {
    if (resultsLayout === 'card') return;
    resultsLayout = 'card';
    applyLayoutClass();
    syncLayoutButtons();
    renderResults();
  });

  layoutListBtn.addEventListener('click', () => {
    if (resultsLayout === 'list') return;
    resultsLayout = 'list';
    applyLayoutClass();
    syncLayoutButtons();
    renderResults();
  });

  loadMoreButton.addEventListener('click', () => {
    if (!nextCursor) return;
    runResultsSearch(currentQuery, nextCursor, true);
  });

  input.addEventListener('input', () => {
    clearButton.hidden = !input.value;
    if (!input.value) clearResults();
  });

  clearButton.addEventListener('click', () => {
    input.value = '';
    clearButton.hidden = true;
    clearResults();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runQuery(input.value.trim());
  });

  syncLayoutButtons();
}
