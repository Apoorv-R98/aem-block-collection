# aem-block-collection (EDS Search Blocks fork)
Frontend blocks for the EDS Semantic Search / Content AI Search initiative (Jira GRANITE-71249). Phase 1 of 3: frontend only, backed by local mock data.

## Environments
- Preview: https://main--{repo}--{owner}.aem.page/
- Live: https://main--{repo}--{owner}.aem.live/

## Blocks added in this fork

- `blocks/semantic-search` — search input + result cards/list, currently backed by `mock-results.json`. Authoring fields: `Placeholder`, `Results Size`, `Results Layout` (`card`/`list`), `Id`.
- `blocks/content-ai-search` — search input with a tabbed **Search Results / AI Mode** UI (matching the `ContentAISupportedSearchV2` core component layout from [adobe/aem-core-wcm-components#3075](https://github.com/adobe/aem-core-wcm-components/pull/3075)), card/list result layouts with a Load More button, and a generative-answer panel with source chips, backed by `mock-results.json`/`mock-answer.json` by default. Authoring fields: `Placeholder`, `AI Search Mode Enabled`, `Gen Search Error Retry Visible`, `Disclaimer Text`, `Results Layout` (`card`/`list`), `Results Size`, `Base URL`, `Content Source`, `Content Source Type`, `Id`.

Both blocks are Phase 1 of a 3-phase plan (frontend / backend / integration) — see [GRANITE-71249](https://jira.corp.adobe.com/browse/GRANITE-71249) for the full design and current status. `semantic-search` doesn't talk to a real backend yet. `content-ai-search` always fetches `/content-sources/search` for the Search Results tab; when `AI Search Mode Enabled` is checked, it also fetches `/content-sources/gensearch` in parallel for the AI Mode tab (both real endpoints if `Base URL` and `Content Source` are authored on the block instance — otherwise it falls back to the mock fixtures). `Base URL` must be the site's own CORS-enabled AEM publish custom domain (e.g. from a `cdn.yaml` CORS configuration per the Crosswalk backend architecture doc), not the raw `*.adobeaemcloud.com` host, and is site-specific — every site adopting this block needs its own. `Content Source Type` must match how the Content AI source was actually created in Cloud Manager (e.g. `ACQUISITION` for a crawled-website source, `AEM_PUBLISH` for a source backed by an AEM publish instance's own index) — defaults to `AEM_PUBLISH` if left blank, but a mismatch here causes the API to reject the request (`400`/`422`) even with CORS and the API key both working correctly.

## Documentation

Before using the aem-block-collection, we recommand you to go through the documentation on https://www.aem.live/docs/ and more specifically:
1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)
5. [AEM Block Collection](https://www.aem.live/developer/block-collection#block-collection-1)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Local development

1. Create a new repository based on the `aem-block-collection` template and add a mountpoint in the `fstab.yaml`
1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `{repo}` directory in your favorite IDE and start coding :)