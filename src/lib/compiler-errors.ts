import type { SolcOutput } from "@openzeppelin/upgrades-core";

// Synthesizes a SolcOutput carrying a single compiler-level error so the
// existing COMPILATION_ERROR wizard step (which just renders
// solcOutput.errors[].formattedMessage) can display a compiler crash the
// same way it displays a normal compilation error.
export function compilerCrashSolcOutput(message: string): SolcOutput {
  return {
    errors: [
      {
        severity: "error",
        formattedMessage: `The Solidity compiler crashed while compiling this contract: ${message}. This is a known limitation of some solc-bin WebAssembly builds (particularly older compiler versions) on large inputs, not something this tool can work around - see https://github.com/ethereum/solidity/issues/13966.`,
      },
    ],
    contracts: {},
    sources: {},
  };
}
