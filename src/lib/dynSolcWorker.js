// Minimal worker to dynamically load any published  version of solc
import wrapper from "solc/wrapper";

function reportError(error) {
  self.postMessage({ error: error instanceof Error ? error.message : String(error) });
}

// Some solc-js wasm builds (particularly older ones, e.g. 0.7.x) can crash
// with a RuntimeError ("memory access out of bounds") on very large inputs -
// a known wasm-build limitation (see
// https://github.com/ethereum/solidity/issues/13966), not something this
// app can fix. That crash surfaces as an *unhandled promise rejection*
// inside the compiler's own internals rather than a normal thrown
// exception, so it wouldn't be caught by a try/catch around compile(), and
// it never reaches the main thread's "message" (or even "error") listener -
// the wizard would otherwise be stuck on the compiling step forever.
self.addEventListener("unhandledrejection", (event) => {
  reportError(event.reason);
});
self.addEventListener("error", (event) => {
  reportError(event.error ?? event.message);
});

self.onmessage = async (msg) => {
  // Expected input:
  // msg.data.solcBin: Name of the target  solc binary to be used
  // msg.data.solcInput: Raw JSON input for the compiler
  // Returns:
  // solcOutput: raw JSON output from the compiler, or `error` if the
  // compiler itself crashed (as opposed to producing compiler-level
  // errors, which still come back as a normal solcOutput.errors array).
  try {
    importScripts(`https://binaries.soliditylang.org/emscripten-wasm32/${msg.data.solcBin}`);
    const compiler = wrapper(self.Module);
    self.postMessage({
      solcOutput: compiler.compile(msg.data.solcInput),
    });
  } catch (error) {
    reportError(error);
  }
};
