# aem-block-collection (EDS Search Blocks fork)
Frontend blocks for the EDS Semantic Search / Content AI Search initiative (Jira GRANITE-71249). Phase 1 of 3: frontend only, backed by local mock data.

## Environments
- Preview: https://main--{repo}--{owner}.aem.page/
- Live: https://main--{repo}--{owner}.aem.live/

## Blocks added in this fork

- `blocks/semantic-search` — search input + result cards/list, currently backed by `mock-results.json`. Authoring fields: `Placeholder`, `Results Size`, `Results Layout` (`card`/`list`), `Id`.
- `blocks/content-ai-search` — search input + generative-answer panel with source chips, currently backed by `mock-answer.json`. Authoring fields: `Placeholder`, `Gen Search Enabled By Default`, `Gen Search Toggle Visible`, `Gen Search Error Fallback`, `Disclaimer Text`, `Id`.

Both blocks are Phase 1 of a 3-phase plan (frontend / backend / integration) — see [GRANITE-71249](https://jira.corp.adobe.com/browse/GRANITE-71249) for the full design and current status. Neither block talks to a real backend yet; the mock JSON fixtures will be replaced with real Content AI-backed endpoints once the backend architecture (Phase 2) is decided.

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