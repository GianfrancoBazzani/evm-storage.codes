import {
  useState,
  createContext,
  Dispatch,
  SetStateAction,
  useEffect,
} from "react";
import { Loader2 } from "lucide-react";
import Landing from "@/components/Landing";
import Header from "@/components/Header";
import StorageVisualizer from "@/components/StorageVisualizer";
import Footer from "./components/Footer";
import AnalyzeWizardButton from "@/components/AnalyzeWizardButton";

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

  // Set when a ?chainId=&address= link misses the storage-layout cache (or
  // caching isn't configured, e.g. local dev without Upstash credentials),
  // so the user still lands on a pre-filled ANALYZE ADDRESS wizard instead
  // of a blank Landing page.
  const [autoFillTarget, setAutoFillTarget] = useState<
    { chainId: number; address: string } | undefined
  >(undefined);

  // Parse URL arguments
  const url = new URL(window.location.href);
  const chainId = url.searchParams.get("chainId");
  const address = url.searchParams.get("address");

  // True while the ?chainId=&address= cache lookup below is in flight, so
  // the Landing page doesn't flash before a cached layout (or the fallback
  // wizard) is ready to render.
  const [isCheckingCache, setIsCheckingCache] = useState(
    Boolean(chainId && address)
  );

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
          setAutoFillTarget({ chainId: Number(chainId), address: address! });
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
        } else {
          setAutoFillTarget({ chainId: Number(chainId), address: address! });
        }
      } catch (error) {
        console.error(
          `Error fetching cached storage layout for chainId: ${chainId} and address: ${address}:`,
          error
        );
        setAutoFillTarget({ chainId: Number(chainId), address: address! });
      } finally {
        setIsCheckingCache(false);
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
        {isCheckingCache ? (
          <div className="min-h-screen w-screen flex items-center justify-center bg-black">
            <Loader2 className="animate-spin h-16 w-16 text-green-500" />
          </div>
        ) : storageLayouts.length === 0 ? (
          <>
            <Landing />
            {autoFillTarget && (
              <AnalyzeWizardButton
                initialChainId={autoFillTarget.chainId}
                initialAddress={autoFillTarget.address}
              />
            )}
          </>
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
