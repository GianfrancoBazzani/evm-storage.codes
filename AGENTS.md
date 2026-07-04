# AGENTS.md

## Commands

- Setup: Node v22 (pinned in `.nvmrc`) and Yarn 4 (`corepack enable`; version pinned via `packageManager` in `package.json`), then `yarn install`.
- `yarn vercel dev` — run the full app (Vite frontend + `api/` serverless functions) at `http://localhost:3000`. Required for any flow that calls `/api/*`: storage layout loading, ERC-7201 extraction, compatibility reports, solc version listing, cached layouts.
- `yarn dev` — Vite frontend only. `/api/*` requests are proxied to `http://localhost:3000` (see `vite.config.ts`), so API-backed flows work only if `yarn vercel dev` is also running.
- `yarn build` — type-checks (`tsc -b`) and builds the production bundle. This is also the only type-check command; there is no separate `typecheck` script.
- `yarn lint` — ESLint.
- `yarn bundle-solc-worker` — rebuilds `public/dynSolcWorkerBundle.js` from `src/lib/dynSolcWorker.js` via Browserify/Babelify. **The bundle is a committed artifact and is what the app actually loads** (`new Worker("/dynSolcWorkerBundle.js")`), so you must re-run this after editing the worker source, and commit the regenerated bundle.

### Environment variables

Redis credentials (used only for layout caching) are read by `Redis.fromEnv()` from `@upstash/redis`, which accepts `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or the `KV_REST_API_URL`/`KV_REST_API_TOKEN` fallbacks. The Vercel project provisions the `KV_*` set via the Marketplace Redis integration, so the fallbacks are what production actually uses — don't be confused by the absence of `UPSTASH_*` names there. The integration also injects `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, and `REDIS_URL` (TCP connection strings); none of those are read by the code, which is REST-only.

All optional locally: without them `api/extract_storage_layout` silently skips caching (empty catch), while `api/get_cached_storage_layout` returns 500, so share-link loading can't be verified. With project access, `vercel env pull` fetches the real values into `.env.local`.

## Architecture

Vite + React 19 + TypeScript SPA in `src/`, plus standalone Vercel serverless functions in `api/` (plain JS, no framework). There is no `vercel.json`; Vercel auto-detects Vite. The whole product is a UI over `@openzeppelin/upgrades-core` — all storage layout semantics (extraction, namespacing, compatibility rules) come from that library, not this codebase.

### The storage layout pipeline

The core flow spans the wizard components, the solc web worker, and the API functions:

1. **Source acquisition** — `UploadWizardButton.tsx` (local files) or `AnalyzeWizardButton.tsx` (fetches verified sources from Sourcify by chainId + address). Both drive the same pipeline.
2. **In-browser compilation** — the frontend spawns `new Worker("/dynSolcWorkerBundle.js")`. The worker `importScripts` the selected solc wasm binary from `binaries.soliditylang.org` and runs `compile()` off the main thread. The available version list comes from `api/get_solc_versions.js` (edge runtime; proxies the solc-bin release list).
3. **ERC-7201 namespaced layouts** — the frontend POSTs the compile input/output to `api/get_namespaced_input.js`, which uses upgrades-core `makeNamespacedInput` to produce a modified solc input; the frontend then compiles *that* in the worker as a second pass. This is why the wizards spawn the worker twice.
4. **Layout extraction** — `api/extract_storage_layout.js` runs upgrades-core `extractStorageLayout` on both outputs. For Sourcify contracts it re-fetches the sources from Sourcify as an integrity check and caches the result in Redis under `${chainId}:${address}`. Cached layouts are deliberately *not* auto-loaded before compilation in the analyze flow because the integrity check is not yet trustless (see TODO in that file).
5. **Rendering** — layouts are appended to `StorageLayoutsContext` (`src/App.tsx`); `Landing.tsx` shows when empty, otherwise one `StorageVisualizer.tsx` per layout, side by side.
6. **Comparison** — `ComparisonWizardButton.tsx` POSTs two extracted layouts to `api/get_compatibility_report.js` → upgrades-core `getStorageUpgradeReport().explain()`.
7. **Share links** — `/?chainId=…&address=…` makes `App.tsx` fetch `api/get_cached_storage_layout.js` on mount.

### Conventions and gotchas

- API payloads carrying solc input/output are **brotli-compressed** (they are large): the frontend uses `brotli-wasm`, the functions use Node's `zlib` brotli. `brotli-wasm` must stay in `optimizeDeps.exclude` in `vite.config.ts` — Vite dep pre-bundling relocates the module away from its `.wasm` file and breaks instantiation at dev time.
- `api/` functions use the Web-standard signature (`export async function POST(request)` returning a `Response`), except `get_solc_versions.js` which uses the edge runtime with a default-export handler.
- Styling is Tailwind CSS v4 (via `@tailwindcss/vite`, no tailwind.config); shadcn/ui-style primitives live in `src/components/ui/` (`components.json`); `@/` aliases `src/`.
