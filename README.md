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

### Scripts

The following commands, defined in the `package.json` file, are available to streamline your development and deployment workflow:

- **yarn dev**: Starts the Vite development server.
- **yarn vercel dev**: Launches the application in a Vercel development environment, simulating a serverless deployment locally.
- **yarn vercel build**: Builds the application for deployment on Vercel, optimizing it for a production serverless environment.
- **yarn build**: Runs TypeScript’s build (`tsc -b`) and then creates an optimized production bundle using Vite.
- **yarn bundle-solc-worker**: Bundles the dynamic Solidity compiler worker code (`dynSolcWorker.js`) using Browserify and Babelify.
- **yarn lint**: Executes ESLint to analyze and flag issues in the code, maintaining quality and consistency.
- **yarn preview**: Serves a preview of the production build locally.

## License

Distributed under the MIT License.
