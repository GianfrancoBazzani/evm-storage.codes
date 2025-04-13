import { useState, createContext, Dispatch, SetStateAction } from "react";
import Landing from "@/components/Landing";
import Header from "@/components/Header";
import StorageVisualizer from "@/components/StorageVisualizer";
import Footer from "./components/Footer";

import type { StorageVisualizerProps } from "@/components/StorageVisualizer";

interface StorageLayoutsContextType {
  storageLayouts: StorageVisualizerProps[];
  setStorageLayouts: Dispatch<SetStateAction<StorageVisualizerProps[]>>;
}
export const StorageLayoutsContext = createContext<
  StorageLayoutsContextType | undefined
>(undefined);

function App() {
  const [storageLayouts, setStorageLayouts] = useState<
    StorageVisualizerProps[]
  >([]);

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden bg-black">
      <StorageLayoutsContext.Provider
        value={{
          storageLayouts,
          setStorageLayouts,
        }}
      >
        {storageLayouts.length === 0 ? (
          <Landing />
        ) : (
          <>
            <div className="flex-grow bg-black text-green-500 px-4">
              <Header />
              <div className="flex flex-col md:flex-row gap-3">
                {storageLayouts.map((storageLayouts, index) => (
                  <StorageVisualizer
                    key={index}
                    contractName={storageLayouts.contractName}
                    id={storageLayouts.id}
                  />
                ))}
              </div>
            </div>
            <Footer />
          </>
        )}
      </StorageLayoutsContext.Provider>
    </div>
  );
}

export default App;
