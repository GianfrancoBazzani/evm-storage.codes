// Minimal worker to dynamically load any published  version of solc
import wrapper from "solc/wrapper";

self.onmessage = async (msg) => {
  // Expected input:
  // msg.data.solcBin: Name of the target  solc binary to be used
  // msg.data.solcInput: Raw JSON input for the compiler
  // Returns:
  // solcOutput: raw JSON output from the compiler
  importScripts(`https://binaries.soliditylang.org/bin/${msg.data.solcBin}`);
  const compiler = wrapper(self.Module);

  self.postMessage({
    solcOutput: compiler.compile(msg.data.solcInput),
  });
};
