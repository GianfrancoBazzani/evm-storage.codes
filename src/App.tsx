import { useState, createContext } from "react";
import Landing from "@/components/Landing";
import Header from "@/components/Header";
import StorageVisualizer from "@/components/StorageVisualizer";
import Footer from "./components/Footer";

export const StorageLayoutsContext = createContext();

function App() {
  const [storageLayouts, setStorageLayouts] = useState(["USDC", "ORIGIN", "SHIBA"]);

  return (
    <StorageLayoutsContext.Provider
      value={{
        storageLayouts: storageLayouts,
        setStorageLayouts: setStorageLayouts,
      }}
    >
      {storageLayouts.length === 0 ? (
        <Landing />
      ) : (
        <div className="h-screen w-screen bg-black text-green-500 px-4">
          <Header />
          <div className=" flex flex-col md:flex-row gap-3">
            {storageLayouts.map((contractName, index) => (
              <StorageVisualizer key={index} contractName={contractName} />
            ))}
          </div>
          <Footer />
        </div>
      )}
    </StorageLayoutsContext.Provider>
  );
}

export default App;
