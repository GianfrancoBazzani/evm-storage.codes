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
  - Fully responsive UI optimized for mobile devices.

### Use Cases
- Visual analysis of storage layouts.
- Compatibility checks for storage layouts during upgrades of proxy-pattern smart contracts.
- Verifying storage layout compatibility when modifying EIP-7702 delegations.

## Acknowledgements

- Special thanks to the OpenZeppelin upgrades development team for their continuous efforts in developing and maintaining upgrades-core.
- Gratitude to the Sourcify.eth team for their commitment to providing reliable, verified smart contract sources.

## Development

### Requirements

  - Node.js: Ensure you have Node.js version v22.x installed. You can manage your Node.js versions using nvm.
  - Yarn: This project uses Yarn as the package manager. If you haven't installed Yarn yet, you can do so by running:
  ```bash
  npm install --global yarn
  ```

### Local development

This project has a Vite frontend and Vercel serverless functions in `api/`.
Some flows need both pieces to be running.

Use `yarn dev` when you only need the frontend Vite server. This is useful for
UI-only work, styling, and components that do not call `/api/*` routes.

Use `yarn vercel dev` when you need the full application locally. Storage layout
loading, ERC-7201 namespaced storage extraction, compatibility reports, compiler
version proxying, and cached layout loading all call Vercel functions under
`/api/*`.

If you run the full app with `yarn dev`, the UI may still load, but API-backed
flows can fail because plain Vite does not serve the `api/` directory.

### Vercel and environment variables

The production app runs the `api/` directory as Vercel serverless functions.
`yarn vercel dev` uses the Vercel CLI to emulate those functions locally.

Some API routes work with public network access only, while cache-related
behavior uses Upstash Redis environment variables:

```bash
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

External contributors may not have access to the project's Vercel team or
production environment variables. In that case, Vercel CLI can still start a
local development server, but routes that depend on missing private environment
variables may log warnings or skip cache-backed behavior.

When opening a PR, mention any API-backed behavior that you could not fully
verify locally because of missing Vercel project access or environment
variables.

### Scripts

The following commands, defined in the `package.json` file, are available to streamline your development and deployment workflow:

- **yarn dev**: Starts the Vite development server for frontend-only work. It does not serve the `/api/*` Vercel functions.
- **yarn vercel dev**: Launches the application in a Vercel development environment, simulating the serverless functions in `api/` locally. Use this for full storage layout and comparison flows.
- **yarn vercel build**: Builds the application for deployment on Vercel, optimizing it for a production serverless environment.
- **yarn build**: Runs TypeScript’s build (`tsc -b`) and then creates an optimized production bundle using Vite.
- **yarn bundle-solc-worker**: Bundles the dynamic Solidity compiler worker code (`dynSolcWorker.js`) using Browserify and Babelify.
- **yarn lint**: Executes ESLint to analyze and flag issues in the code, maintaining quality and consistency.
- **yarn preview**: Serves a preview of the production build locally.

### Troubleshooting local setup

If storage layout loading fails locally, first confirm that the app was started
with `yarn vercel dev`, not plain `yarn dev`.

If Vercel CLI asks to connect a project and you do not have access to the
upstream Vercel project, you can continue with local development, but private
environment-backed behavior such as Redis caching may not be available.

If you see Upstash Redis warnings locally, check whether the Redis environment
variables above are configured. Missing Redis variables should not affect
frontend-only work, but cache-backed routes cannot be fully verified without
them.

## License

Distributed under the MIT License.
