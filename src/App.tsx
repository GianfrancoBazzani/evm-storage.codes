import {
  useState,
  createContext,
  Dispatch,
  SetStateAction,
  useEffect,
} from "react";
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

  // Parse URL arguments
  const url = new URL(window.location.href);
  const chainId = url.searchParams.get("chainId");
  const address = url.searchParams.get("address");

  // Check if the storage is cached
  useEffect(() => {
    if (!chainId || !address) return;

    async function fetchCachedStorageLayout() {
      try {
        const response = await fetch("/api/get_cached_storage_layout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId, address }),
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (data.storageLayout) {
          // Use a default contract name since the API doesn't provide one
          setStorageLayouts([
            {
              contractName: data.contractName,
              id: 0,
              storageLayout: data.storageLayout,
              chainId: Number(chainId),
              address: address ? address : undefined,
            },
          ]);
        }
      } catch (error) {
        console.error(
          `Error fetching cached storage layout for chainId: ${chainId} and address: ${address}:`,
          error
        );
      }
    }
    fetchCachedStorageLayout();
  }, [chainId, address]);

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
                {storageLayouts.map((storageLayout, index) => (
                  <StorageVisualizer
                    key={index}
                    contractName={storageLayout.contractName}
                    storageLayout={storageLayout.storageLayout}
                    id={storageLayout.id}
                    chainId={storageLayout.chainId}
                    address={storageLayout.address}
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
