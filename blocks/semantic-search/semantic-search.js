import { readBlockConfig } from '../../scripts/aem.js';

const DEFAULT_RESULTS_SIZE = 10;

async function fetchMockResults() {
  const url = `${window.hlx.codeBasePath}/blocks/semantic-search/mock-results.json`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to load mock results: ${resp.status}`);
  }
  return resp.json();
}

function renderCard(item) {
  const { data = {} } = item;
  const title = data.title || 'Untitled';
  const { description = '', image = '', source = '#' } = data;

  const card = document.createElement('a');
  card.className = 'cmp-semantic-search__card';
  card.href = source;

  if (image) {
    const imageWrap = document.createElement('div');
    imageWrap.className = 'cmp-semantic-search__card-image';
    const img = document.createElement('img');
    img.src = image;
    img.alt = title;
    img.loading = 'lazy';
    imageWrap.append(img);
    card.append(imageWrap);
  }

  const body = document.createElement('div');
  body.className = 'cmp-semantic-search__card-body';

  const titleEl = document.createElement('div');
  titleEl.className = 'cmp-semantic-search__card-title';
  titleEl.textContent = title;
  body.append(titleEl);

  if (description) {
    const descriptionEl = document.createElement('p');
    descriptionEl.className = 'cmp-semantic-search__card-description';
    descriptionEl.textContent = description;
    body.append(descriptionEl);
  }

  card.append(body);
  return card;
}

function renderResults(resultsEl, items, layout) {
  resultsEl.innerHTML = '';
  resultsEl.classList.toggle('cmp-semantic-search__results--list', layout === 'list');
  resultsEl.classList.toggle('cmp-semantic-search__results--card', layout !== 'list');

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'cmp-semantic-search__empty';
    empty.textContent = 'No results found.';
    resultsEl.append(empty);
    return;
  }

  items.forEach((item) => resultsEl.append(renderCard(item)));
}

function showLoading(resultsEl) {
  resultsEl.innerHTML = '';
  const loading = document.createElement('p');
  loading.className = 'cmp-semantic-search__loading';
  loading.textContent = 'Searching…';
  resultsEl.append(loading);
}

function showError(resultsEl, message) {
  resultsEl.innerHTML = '';
  const error = document.createElement('p');
  error.className = 'cmp-semantic-search__error';
  error.textContent = message;
  resultsEl.append(error);
}

export default function decorate(block) {
  const config = readBlockConfig(block);
  const placeholder = config.placeholder || 'Search…';
  const resultsSize = parseInt(config.resultsSize, 10) || DEFAULT_RESULTS_SIZE;
  const resultsLayout = config.resultsLayout === 'list' ? 'list' : 'card';
  const { id } = config;

  block.innerHTML = '';
  block.classList.add('cmp-semantic-search');
  if (id) block.id = id;

  const form = document.createElement('form');
  form.className = 'cmp-semantic-search__form';
  form.setAttribute('role', 'search');

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'cmp-semantic-search__input';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', placeholder);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'cmp-semantic-search__submit';
  submit.textContent = 'Search';

  form.append(input, submit);

  const resultsEl = document.createElement('div');
  resultsEl.className = 'cmp-semantic-search__results';
  resultsEl.setAttribute('role', 'status');
  resultsEl.setAttribute('aria-live', 'polite');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    showLoading(resultsEl);
    try {
      const data = await fetchMockResults();
      const items = (data.results || []).slice(0, resultsSize);
      renderResults(resultsEl, items, resultsLayout);
    } catch (error) {
      showError(resultsEl, 'Search failed. Please try again.');
    }
  });

  block.append(form, resultsEl);
}
