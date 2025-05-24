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
      <div className="flex flex-col md:max-w-2xl border border-green-500 mt-12 mb-8 mx-6 p-6 rounded-lg">
        <span className="flex mb-4">
          Analyze and compare EVM smart contracts storage layouts.
        </span>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <UploadWizardButton />
          <AnalyzeWizardButton />
        </div>
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
    </div>
  );
}
