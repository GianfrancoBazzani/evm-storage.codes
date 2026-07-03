# EVM-Storage.codes

![EVM-Storage.codes](/public/banner.png)

[**EVM-Storage.codes**](https://evm-storage.codes/) is an online web tool designed to visualize, compare, and analyze Ethereum smart contract storage layouts.

## Overview

EVM-Storage.codes leverages [OpenZeppelin's upgrades-core](https://github.com/OpenZeppelin/openzeppelin-upgrades) library to analyze smart contract storage and generate compatibility reports. Essentially, it provides a user-friendly interface for the upgrades-core module.

### Features
  - Upload local smart contracts or fetch their code from verified sources on [Sourcify.eth](https://sourcify.dev/).
  - Perform in-browser compilation using a dynamic solc web worker.
  - Display a graphical representation of smart contract storage layouts in the UI.
  - Full support for [ERC-7201](https://eips.ethereum.org/EIPS/eip-7201) namespaced storage layouts and custom storage layouts released with [Solidity 0.8.29](https://soliditylang.org/blog/2025/03/12/solidity-0.8.29-release-announcement/).
  - Backend caching of storage layouts, allowing the reuse of already compiled layouts without repeated recompilation.
  - Responsive UI optimized for mobile devices.

### Use Cases
- Visual analysis of storage layouts.
- Compatibility checks for storage layouts during upgrades of proxy-pattern smart contracts.
- Verifying storage layout compatibility when modifying EIP-7702 delegations.

## Acknowledgements

- Special thanks to the OpenZeppelin upgrades development team for their continuous efforts in developing and maintaining upgrades-core.
- Gratitude to the Sourcify.eth team for their commitment to providing reliable, verified smart contract sources.

## Development

### Requirements

- **Node.js v22** — the exact version is pinned in `.nvmrc`; run `nvm use` if you use nvm.
- **Yarn 4** — the project pins `yarn@4.0.2` via the `packageManager` field in `package.json`. Enable it with [Corepack](https://yarnpkg.com/corepack), which ships with Node.js:
  ```bash
  corepack enable
  ```

### Local development

The app has two parts: a Vite frontend and Vercel serverless functions in `api/`
(storage layout extraction, ERC-7201 namespaced storage, compatibility reports,
solc version listing, and cached layout lookups).

- **`yarn vercel dev`** runs the full application — frontend plus `api/` functions — at `http://localhost:3000`. Use this whenever your work touches storage layout loading or comparison.
- **`yarn dev`** runs only the Vite frontend. Requests to `/api/*` are proxied to `http://localhost:3000`, so API-backed flows fail unless `yarn vercel dev` is also running. Use it for UI-only work such as styling and components.

Layout caching uses Upstash Redis. The API code calls `Redis.fromEnv()`, which
reads `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` and falls back to
`KV_REST_API_URL` / `KV_REST_API_TOKEN`. The upstream Vercel project uses the
Marketplace Redis integration, which provisions the `KV_*` naming — so those
fallbacks are what the deployed app actually runs on:

| Variable | Read by the app | Purpose |
| --- | --- | --- |
| `KV_REST_API_URL` | Yes | REST endpoint of the Redis database. |
| `KV_REST_API_TOKEN` | Yes | Read/write token for the REST API. |
| `KV_REST_API_READ_ONLY_TOKEN` | No | Read-only REST token; provisioned by the integration but unused. |
| `KV_URL` | No | `rediss://` TCP connection string for socket clients; the app is REST-only. |
| `REDIS_URL` | No | Alias of the TCP connection string; unused. |

The Redis variables are optional for local development: without them, storage layout
extraction still works and caching is silently skipped, but cache-backed routes
(such as loading shared layouts) cannot be fully verified. External contributors
without access to the upstream Vercel project can link the repository to their
own Vercel account when `vercel dev` prompts for setup. When opening a PR,
mention any API-backed behavior you could not verify locally.

### Scripts

- **`yarn dev`**: Starts the Vite development server.
- **`yarn vercel dev`**: Runs the app in a local Vercel environment (frontend + serverless functions).
- **`yarn vercel build`**: Builds the application for deployment on Vercel.
- **`yarn build`**: Type-checks (`tsc -b`) and creates an optimized production bundle with Vite.
- **`yarn bundle-solc-worker`**: Bundles the dynamic Solidity compiler worker (`src/lib/dynSolcWorker.js`) into `public/dynSolcWorkerBundle.js` using Browserify and Babelify.
- **`yarn lint`**: Runs ESLint.
- **`yarn preview`**: Serves a preview of the production build locally.

## License

Distributed under the MIT License.
