# EDS Search Blocks — Phase 1 (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two new EDS blocks — `semantic-search` and `content-ai-search` — that render a full search UI (input, loading/empty/error states, result cards or a generative-answer panel) against a local mock JSON fixture, so the frontend can be built and demoed independently of the not-yet-decided Content AI backend.

**Architecture:** Two self-contained blocks following this repo's existing `blocks/{name}/{name}.js` + `{name}.css` convention (see `blocks/search`, `blocks/contentai-hero` reference in frescopa). Each block reads its authoring config from block-table rows via `readBlockConfig` (from `scripts/aem.js`), fetches a static JSON fixture shipped in its own folder on form submit, and renders results/answer into the DOM. No server calls, no build step, no new dependencies.

**Tech Stack:** Vanilla ES6+ JavaScript (no transpiling), CSS3, the existing `aem-block-collection` tooling (ESLint airbnb-base, Stylelint standard, `@adobe/aem-cli` for local preview).

## Global Constraints

- No test framework exists in this repo (no Jest, no `*.test.js`) — verification is `npm run lint` (ESLint + Stylelint) plus manual checks against the local AEM CLI dev server (`aem up`), per this repo's `AGENTS.md`. Every task below substitutes "run lint + verify in dev server" for the usual "run the test suite" step.
- Follow `AGENTS.md` code style: ES6+, Airbnb ESLint rules, `.js` extensions on all imports, Unix (LF) line endings, mobile-first CSS with `min-width` breakpoints at 600px/900px/1200px, all selectors scoped to the block's own class (`.semantic-search .foo`, never bare `.foo`), never use `{blockname}-container`/`{blockname}-wrapper` as class names (reserved for auto-generated section/block wrappers).
- BEM element naming inside each block: `cmp-semantic-search__*` and `cmp-content-ai-search__*`, mirroring the existing AEM `ContentAISupportedSearch` core component's `cmp-contentaisearch__*` convention.
- Both blocks fetch a **local static JSON fixture** shipped in their own block folder (e.g. `blocks/semantic-search/mock-results.json`) instead of any real network/backend endpoint. The real Content AI backend (Phase 2) and wiring it up (Phase 3) are explicitly **out of scope** for this plan.
- Authoring fields are plain block-table rows (key/value pairs), parsed with `readBlockConfig(block)` — this repo has no `component-definition.json`/`component-models.json` (that's a DA.live/Universal Editor-specific pattern used in other projects like frescopa, not present here).
- Never modify `scripts/aem.js` (explicitly forbidden by `AGENTS.md`).
- Work happens on branch `GRANITE-71249`, already checked out, tracking `fork/GRANITE-71249` (`https://github.com/Apoorv-R98/aem-block-collection`).

---

### Task 1: Semantic Search block

**Files:**
- Create: `blocks/semantic-search/semantic-search.js`
- Create: `blocks/semantic-search/semantic-search.css`
- Create: `blocks/semantic-search/mock-results.json`
- Create: `drafts/semantic-search.html`

**Interfaces:**
- Produces: `export default function decorate(block)` — standard EDS block entry point, called automatically by `scripts/aem.js`'s block loader once this file exists in `blocks/semantic-search/`.
- Consumes: `readBlockConfig` from `../../scripts/aem.js` (existing export, do not modify).

- [ ] **Step 1: Write the mock data fixture**

Create `blocks/semantic-search/mock-results.json`, shaped like the real `ContentAISearchResponse` this will eventually be replaced by (`totalResults`, `results[].data`, `hasMore`, `sourceCursors`):

```json
{
  "totalResults": 3,
  "hasMore": false,
  "sourceCursors": {},
  "results": [
    {
      "id": "story-1",
      "score": 0.92,
      "data": {
        "title": "The Origins of Fréscopa Coffee",
        "description": "Discover how our beans are sourced from high-altitude farms across three continents.",
        "image": "/media/coffee-origins.jpg",
        "source": "/stories/coffee-origins"
      }
    },
    {
      "id": "story-2",
      "score": 0.87,
      "data": {
        "title": "Brewing the Perfect Pour-Over",
        "description": "A step-by-step guide to our recommended brewing method for light roasts.",
        "image": "/media/pour-over.jpg",
        "source": "/stories/pour-over-guide"
      }
    },
    {
      "id": "story-3",
      "score": 0.81,
      "data": {
        "title": "Sustainability at Every Step",
        "description": "How Fréscopa partners with growers to reduce water usage and protect biodiversity.",
        "image": "/media/sustainability.jpg",
        "source": "/stories/sustainability"
      }
    }
  ]
}
```

- [ ] **Step 2: Write `semantic-search.js`**

```javascript
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
```

- [ ] **Step 3: Write `semantic-search.css`**

```css
.semantic-search.cmp-semantic-search {
  display: block;
}

.semantic-search .cmp-semantic-search__form {
  display: flex;
  gap: 0.5em;
  align-items: center;
}

.semantic-search .cmp-semantic-search__input {
  flex: 1;
  box-sizing: border-box;
  padding: 0.6em 0.8em;
  border: 1px solid var(--dark-color, #ccc);
  border-radius: 4px;
  font-size: var(--body-font-size-m, 1rem);
}

.semantic-search .cmp-semantic-search__submit {
  padding: 0.6em 1.2em;
  border: none;
  border-radius: 4px;
  background-color: var(--link-color, #05a);
  color: #fff;
  cursor: pointer;
}

.semantic-search .cmp-semantic-search__submit:hover {
  background-color: var(--link-hover-color, #04c);
}

.semantic-search .cmp-semantic-search__results {
  margin-top: 1.5em;
}

.semantic-search .cmp-semantic-search__results--card {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1em;
}

@media (min-width: 600px) {
  .semantic-search .cmp-semantic-search__results--card {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 900px) {
  .semantic-search .cmp-semantic-search__results--card {
    grid-template-columns: repeat(3, 1fr);
  }
}

.semantic-search .cmp-semantic-search__results--list {
  display: flex;
  flex-direction: column;
  gap: 1em;
}

.semantic-search .cmp-semantic-search__card {
  display: block;
  border: 1px solid #dadada;
  border-radius: 8px;
  overflow: hidden;
  color: currentcolor;
  text-decoration: none;
}

.semantic-search .cmp-semantic-search__card:hover,
.semantic-search .cmp-semantic-search__card:focus {
  text-decoration: none;
  border-color: var(--link-color, #05a);
}

.semantic-search .cmp-semantic-search__card-image img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.semantic-search .cmp-semantic-search__card-body {
  padding: 0.8em 1em;
}

.semantic-search .cmp-semantic-search__card-title {
  font-weight: 600;
  margin-bottom: 0.3em;
}

.semantic-search .cmp-semantic-search__card-description {
  font-size: var(--body-font-size-s, 0.9rem);
  margin: 0;
}

.semantic-search .cmp-semantic-search__empty,
.semantic-search .cmp-semantic-search__loading,
.semantic-search .cmp-semantic-search__error {
  text-align: center;
  color: var(--text-color, #333);
}

.semantic-search .cmp-semantic-search__error {
  color: #a33532;
}
```

- [ ] **Step 4: Write the draft test page**

Create `drafts/semantic-search.html` (block-table markup: header row becomes the block class, each subsequent row is a `Key`/`Value` pair parsed by `readBlockConfig`):

```html
<body>
  <header></header>
  <main>
    <div>
      <h1>Semantic Search</h1>
      <div class="semantic-search">
        <div>
          <div>Placeholder</div>
          <div>Search our stories…</div>
        </div>
        <div>
          <div>Results Size</div>
          <div>6</div>
        </div>
        <div>
          <div>Results Layout</div>
          <div>card</div>
        </div>
        <div>
          <div>Id</div>
          <div>stories-semantic-search</div>
        </div>
      </div>
    </div>
  </main>
  <footer></footer>
</body>
```

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors from either `semantic-search.js` or `semantic-search.css`. Fix any Airbnb/Stylelint violations before moving on.

- [ ] **Step 6: Verify in the local dev server**

Run: `npx -y @adobe/aem-cli up --no-open --forward-browser-logs --html-folder drafts` (background it if possible)
Then: `curl -s http://localhost:3000/semantic-search.plain.html` (rename the draft file to `semantic-search.plain.html` if the CLI requires the `.plain.html` extension for pre-rendered drafts — check the CLI's `--html-folder` output/help if the first curl 404s) and confirm the raw block markup comes back.
Open `http://localhost:3000/semantic-search` in a browser (or ask the human to, if no browser tool is available): confirm the input renders with the "Search our stories…" placeholder, typing a query and submitting shows the 3 mock cards in a 3-column grid on desktop width, and the empty/loading states are visually reasonable (throttle network in devtools to see the loading state if needed).

- [ ] **Step 7: Commit**

```bash
git add blocks/semantic-search drafts/semantic-search.html
git commit -m "feat: add semantic-search block (mock data, Phase 1 frontend)"
```

---

### Task 2: Content AI Search block

**Files:**
- Create: `blocks/content-ai-search/content-ai-search.js`
- Create: `blocks/content-ai-search/content-ai-search.css`
- Create: `blocks/content-ai-search/mock-answer.json`
- Create: `drafts/content-ai-search.html`

**Interfaces:**
- Produces: `export default function decorate(block)`.
- Consumes: `readBlockConfig` from `../../scripts/aem.js` (same as Task 1; no shared runtime state between the two blocks — each is fully independent).

- [ ] **Step 1: Write the mock data fixture**

Create `blocks/content-ai-search/mock-answer.json`, shaped like the real `ContentSourceQueryResult` (`query`, `result`, `hits[].metadata`) this will eventually be replaced by:

```json
{
  "query": "What makes Fréscopa coffee sustainable?",
  "result": "Fréscopa sources beans from high-altitude farms that use shade-grown cultivation to protect biodiversity, partners directly with growers on water-conservation programs, and ships in fully recyclable packaging. Roasting is done in small batches to minimize energy waste.",
  "hits": [
    {
      "id": "story-3",
      "metadata": {
        "title": "Sustainability at Every Step",
        "source": "/stories/sustainability"
      }
    },
    {
      "id": "story-1",
      "metadata": {
        "title": "The Origins of Fréscopa Coffee",
        "source": "/stories/coffee-origins"
      }
    }
  ]
}
```

- [ ] **Step 2: Write `content-ai-search.js`**

```javascript
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
      const link = document.createElement('a');
      link.className = 'cmp-content-ai-search__source-chip';
      link.href = meta.source || '#';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = meta.title || hit.id || 'Source';
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
  const toggleVisible = config.genSearchToggleVisible !== 'false';
  const enabledByDefault = config.genSearchEnabledByDefault !== 'false';
  const errorFallback = config.genSearchErrorFallback
    || 'Sorry, we could not generate an answer. Please try again.';
  const disclaimerText = config.disclaimerText || '';

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
```

- [ ] **Step 3: Write `content-ai-search.css`**

```css
.content-ai-search.cmp-content-ai-search {
  display: block;
}

.content-ai-search .cmp-content-ai-search__form {
  display: flex;
  gap: 0.5em;
  align-items: center;
}

.content-ai-search .cmp-content-ai-search__input {
  flex: 1;
  box-sizing: border-box;
  padding: 0.6em 0.8em;
  border: 1px solid var(--dark-color, #ccc);
  border-radius: 4px;
  font-size: var(--body-font-size-m, 1rem);
}

.content-ai-search .cmp-content-ai-search__submit {
  padding: 0.6em 1.2em;
  border: none;
  border-radius: 4px;
  background-color: var(--link-color, #05a);
  color: #fff;
  cursor: pointer;
}

.content-ai-search .cmp-content-ai-search__submit:hover {
  background-color: var(--link-hover-color, #04c);
}

.content-ai-search .cmp-content-ai-search__toggle {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-top: 0.8em;
  font-size: var(--body-font-size-s, 0.9rem);
}

.content-ai-search .cmp-content-ai-search__summary {
  margin-top: 1.5em;
}

.content-ai-search .cmp-content-ai-search__summary-card {
  border: 1px solid #dadada;
  border-radius: 8px;
  padding: 1em 1.2em;
  background-color: var(--background-color, #f9f9f9);
}

.content-ai-search .cmp-content-ai-search__summary-header {
  font-weight: 600;
  margin-bottom: 0.5em;
}

.content-ai-search .cmp-content-ai-search__summary-text {
  line-height: 1.5;
}

.content-ai-search .cmp-content-ai-search__sources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  margin-top: 1em;
  align-items: center;
}

.content-ai-search .cmp-content-ai-search__sources-label {
  font-size: var(--body-font-size-s, 0.9rem);
  font-weight: 600;
  margin-right: 0.3em;
}

.content-ai-search .cmp-content-ai-search__source-chip {
  padding: 0.3em 0.7em;
  border-radius: 999px;
  background-color: #eee;
  color: currentcolor;
  text-decoration: none;
  font-size: var(--body-font-size-s, 0.85rem);
}

.content-ai-search .cmp-content-ai-search__source-chip:hover {
  background-color: #ddd;
}

.content-ai-search .cmp-content-ai-search__disclaimer {
  margin-top: 0.8em;
  font-size: var(--body-font-size-s, 0.85rem);
  color: #666;
}

.content-ai-search .cmp-content-ai-search__loading,
.content-ai-search .cmp-content-ai-search__error {
  text-align: center;
}

.content-ai-search .cmp-content-ai-search__error {
  color: #a33532;
}
```

- [ ] **Step 4: Write the draft test page**

Create `drafts/content-ai-search.html`:

```html
<body>
  <header></header>
  <main>
    <div>
      <h1>Content AI Search</h1>
      <div class="content-ai-search">
        <div>
          <div>Placeholder</div>
          <div>Ask about Fréscopa stories…</div>
        </div>
        <div>
          <div>Gen Search Enabled By Default</div>
          <div>true</div>
        </div>
        <div>
          <div>Gen Search Toggle Visible</div>
          <div>true</div>
        </div>
        <div>
          <div>Gen Search Error Fallback</div>
          <div>Sorry, we couldn't generate an answer right now.</div>
        </div>
        <div>
          <div>Disclaimer Text</div>
          <div>AI-generated answers may be inaccurate. Always verify with the source stories.</div>
        </div>
        <div>
          <div>Id</div>
          <div>stories-content-ai-search</div>
        </div>
      </div>
    </div>
  </main>
  <footer></footer>
</body>
```

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors from either `content-ai-search.js` or `content-ai-search.css`.

- [ ] **Step 6: Verify in the local dev server**

With the dev server from Task 1 still running (or restarted with `--html-folder drafts`):
Run: `curl -s http://localhost:3000/content-ai-search.plain.html` and confirm the raw block markup comes back.
Open `http://localhost:3000/content-ai-search` in a browser: confirm the input renders, the "Show generative summary" toggle is checked by default, submitting a query shows the generative-answer panel with the mock answer text and two source chips, unchecking the toggle before submitting shows nothing in the summary area, and the loading/error states render sensibly.

- [ ] **Step 7: Commit**

```bash
git add blocks/content-ai-search drafts/content-ai-search.html
git commit -m "feat: add content-ai-search block (mock data, Phase 1 frontend)"
```

---

### Task 3: Documentation and PR readiness

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing new — this task only documents Tasks 1 and 2's output and prepares the branch for review.

- [ ] **Step 1: Document the two new blocks in the README**

Add a short "Blocks" section to `README.md` (after the "Local development" section) — replace the entire file's placeholder title/description too, since they're still the template defaults:

```markdown
# aem-block-collection (EDS Search Blocks fork)
Frontend blocks for the EDS Semantic Search / Content AI Search initiative (Jira GRANITE-71249). Phase 1 of 3: frontend only, backed by local mock data.

## Environments
- Preview: https://main--{repo}--{owner}.aem.page/
- Live: https://main--{repo}--{owner}.aem.live/

## Blocks added in this fork

- `blocks/semantic-search` — search input + result cards/list, currently backed by `mock-results.json`. Authoring fields: `Placeholder`, `Results Size`, `Results Layout` (`card`/`list`), `Id`.
- `blocks/content-ai-search` — search input + generative-answer panel with source chips, currently backed by `mock-answer.json`. Authoring fields: `Placeholder`, `Gen Search Enabled By Default`, `Gen Search Toggle Visible`, `Gen Search Error Fallback`, `Disclaimer Text`, `Id`.

Both blocks are Phase 1 of a 3-phase plan (frontend / backend / integration) — see `aem-core-wcm-components`'s `docs/superpowers/specs/2026-07-30-eds-content-ai-search-blocks-design.md` for the full design. Neither block talks to a real backend yet; the mock JSON fixtures will be replaced with real Content AI-backed endpoints once the backend architecture (Phase 2) is decided.
```

Keep the rest of the file (Documentation, Installation, Linting, Local development sections) as-is.

- [ ] **Step 2: Final lint pass**

Run: `npm run lint`
Expected: `BUILD SUCCESS`-equivalent — zero errors across the whole repo, not just the new files (catches any pre-existing issues the new blocks might have surfaced, e.g. import ordering).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document semantic-search and content-ai-search blocks"
```

- [ ] **Step 4: Push and open a draft PR against the fork**

```bash
git push fork GRANITE-71249
gh pr create --repo Apoorv-R98/aem-block-collection --base main --head GRANITE-71249 --draft \
  --title "GRANITE-71249: Semantic Search / Content AI Search blocks (Phase 1 — frontend, mock data)" \
  --body "Phase 1 of 3 (frontend / backend / integration) for GRANITE-71249. Adds \`semantic-search\` and \`content-ai-search\` EDS blocks backed by local mock JSON fixtures — no real backend yet (Phase 2/3, blocked on a separate backend-architecture decision). Test pages: \`drafts/semantic-search.html\`, \`drafts/content-ai-search.html\`."
```

Note: per this repo's `AGENTS.md` publishing process, a real PR to `adobe/aem-block-collection` would need a feature-preview URL (`https://{branch}--aem-block-collection--{owner}.aem.page/{path}`) demonstrating the change — that requires the fork to have AEM Code Sync installed and a live site config, which is out of scope for this plan. This step targets the **fork** as a draft PR only, to checkpoint the work; do not open a PR against `adobe/aem-block-collection` until Phase 3 is complete and the blocks work end-to-end.

---

## Self-review notes

- **Spec coverage**: both blocks from the design spec (Section 3) are covered — Semantic Search (Task 1) and Content AI Search (Task 2) — with the authoring fields exactly as decided (Section on "Match the AEM component's dialog fields now"). Mock-data-only scope, BEM naming, and the phased approach (Section 6 of the spec) are reflected in Global Constraints and Task 3.
- **Placeholder scan**: no TBD/TODO markers; every step has real, runnable code or an exact shell command.
- **Type/naming consistency**: `decorate(block)` signature matches across both tasks; `readBlockConfig` field names (`placeholder`, `resultsSize`, `resultsLayout`, `id`, `genSearchEnabledByDefault`, `genSearchToggleVisible`, `genSearchErrorFallback`, `disclaimerText`) are consistent between each block's draft HTML row labels (via `toCamelCase`) and its JS.
- **Deviation from a strict TDD plan**: this repo has no test framework at all (confirmed via `package.json`/repo search) and `AGENTS.md` explicitly documents dev-server + curl + lint as this project's verification method — each task's steps 5–6 substitute for "write failing test / make it pass."
