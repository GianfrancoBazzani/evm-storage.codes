import wrapper from "solc/wrapper";

self.onmessage = async (msg) => {

  let solcInput = msg.data.solcInput;
  solcInput["language"] = "Solidity";
  solcInput["settings"] = {
    outputSelection: {
      "*": {
        "*": ["*"],
      },
    },
  };

  // TODO: Test if imports are resolved
  function findImports(path) {
    return {
      contents: msg.data.sourceFiles[path],
    };
  }

  importScripts(`https://binaries.soliditylang.org/bin/${msg.data.solcBin}`);
  const compiler = wrapper(self.Module);

  self.postMessage({
    //solcOutput: JSON.parse(
    //  compiler.compile(JSON.stringify(solcInput), { import: findImports })
    //),
    solcOutput: "hello", // TODO: Test if webwoker downloads solc dynamically works
  });
};
