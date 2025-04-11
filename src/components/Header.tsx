import { Github } from "lucide-react";

export default function Header() {
  return (
    <header className="flex justify-between items-center mb-3 mt-2 border-b border-green-500 pb-1">
      <div className="flex flex-row items-center gap-2">
        <a href="/">
          <img
            src="/floppy-logo.png"
            alt="floppy-logo"
            className="h-8 w-8 md:h-10 md:w-10"
          />
        </a>
        <span className="text-xl md:text-2xl font-bold tracking-wider">
          EVM Storage.codes
        </span>
      </div>
      <div>
        <a
          href="https://github.com/GianfrancoBazzani/evm-storage.codes/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className=" text-green-700 hover:text-green-500 p-2 rounded duration-200">
            <Github size={21} />
            <span className="sr-only">GitHub</span>
          </div>
        </a>
      </div>
    </header>
  );
}
