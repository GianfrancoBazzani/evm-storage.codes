import { Github, Coffee } from "lucide-react";
import UploadWizardButton from "@/components/UploadWizardButton";
import AnalyzeWizardButton from "@/components/AnalyzeWizardButton";

export default function Landing() {
  // ASCII art for the title
  const asciiTitle = `
███████╗██╗   ██╗███╗   ███╗    ███████╗████████╗ ██████╗ ██████╗  █████╗  ██████╗ ███████╗    ██████╗ ██████╗ ██████╗ ███████╗███████╗
██╔════╝██║   ██║████╗ ████║    ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔══██╗██╔════╝ ██╔════╝   ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔════╝
█████╗  ██║   ██║██╔████╔██║    ███████╗   ██║   ██║   ██║██████╔╝███████║██║  ███╗█████╗     ██║     ██║   ██║██║  ██║█████╗  ███████╗
██╔══╝  ╚██╗ ██╔╝██║╚██╔╝██║    ╚════██║   ██║   ██║   ██║██╔══██╗██╔══██║██║   ██║██╔══╝     ██║     ██║   ██║██║  ██║██╔══╝  ╚════██║
███████╗ ╚████╔╝ ██║ ╚═╝ ██║    ███████║   ██║   ╚██████╔╝██║  ██║██║  ██║╚██████╔╝███████╗██╗╚██████╗╚██████╔╝██████╔╝███████╗███████║
╚══════╝  ╚═══╝  ╚═╝     ╚═╝    ╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝
`;

  interface Examples {
    name: string;
    address: string;
    chainId: string;
  }

  const examples: Array<Examples> = [
    {
      name: "Uni Token",
      address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      chainId: "1",
    },
    {
      name: "Openfort EIP-7702",
      address: "0x9C5b2765fe0aC3f0566CD6B1c96c0cCD393EE49c",
      chainId: "84532",
    },
    {
      name: "MorphoToken",
      address: "0x4364fd2371b6318159366abfa51f190df5c24852",
      chainId: "1",
    },
    {
      name: "Uniswap Calibur EIP-7702",
      address: "0x000000009B1D0aF20D8C6d0A44e162d11F9b8f00",
      chainId: "1",
    },
    {
      name: "Uniswap V4 PoolManager",
      address: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      chainId: "1",
    }
  ];

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-green-500 text-center">
      {/* Main Logo */}
      <div className="flex flex-row items-center justify-center gap-4">
        <img
          src="/floppy-logo.png"
          alt="floppy-logo"
          className="hidden lg:flex object-contain max-h-20"
        />
        <pre className="flex-1 text-green-500 text-[0.25rem] md:text-[0.4rem] lg:text-xs leading-none">
          {asciiTitle}
        </pre>
      </div>

      {/* Buttons */}
      <div className="flex flex-col items-center md:w-xl border border-green-500 mt-12 mb-8 mx-6 p-6 rounded-lg">
        <span className="flex mb-4">
          Analyze and compare EVM smart contracts storage layouts.
        </span>
        <div className="flex flex-col mb-8 sm:flex-row items-center justify-center gap-4">
          <UploadWizardButton />
          <AnalyzeWizardButton />
        </div>

        {/* Explore Storage Layout  */}
        <h2 className="flex mb-4">
          Not sure what to look for? Explore interesting storage layouts
        </h2>
        {examples.length > 0 ? (
          <ul className="list-disc pl-6 text-left">
            {examples.map((example, index) => (
              <li key={index}>
                <a
                  href={`https://evm-storage.codes/?address=${example.address}&chainId=${example.chainId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className=" underline"
                >
                  {example.name}: {example.address.slice(0, 10)}...$
                  {example.address.slice(-8)} (Chain ID: {example.chainId})
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-green-500">No examples available to test.</p>
        )}
      </div>

      {/* Links */}
      <div className="mt-12 flex gap-8 text-center text-xs">
        <a
          href="https://buymeacoffee.com/gianfrancobazzani"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="flex flex-col items-center">
            <Coffee className="h-8 w-8 mb-2 text-green-600" />
            <p>BUY ME A COFFE</p>
          </div>
        </a>
        <a
          href="https://github.com/GianfrancoBazzani/evm-storage.codes/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="flex flex-col items-center">
            <Github className="h-8 w-8 mb-2 text-green-600" />
            <p>CONTRIBUTE TO REPO</p>
          </div>
        </a>
      </div>

      {/* Powered by Banner */}
      <div className="mt-12 text-xs">
        <span>Powered by </span>
        <a
          href="https://github.com/OpenZeppelin/openzeppelin-upgrades"
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-green-600"
        >
          OpenZeppelin upgrades
        </a>
        <span> and </span>
        <a
          href="https://sourcify.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-green-600"
        >
          Sourcify.eth
        </a>
      </div>
    </div>
  );
}
