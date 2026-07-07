import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Landing from "@/components/Landing";
import Header from "@/components/Header";
import StorageVisualizer from "@/components/StorageVisualizer";
import Footer from "./components/Footer";
import { StorageLayoutsContext } from "@/contexts/StorageLayoutsContext";
import ShareLinkNotFound from "@/components/ShareLinkNotFound";
import { ethAddressSchema } from "@/lib/ethAddress";

import type { StorageVisualizerProps } from "@/components/StorageVisualizer";
import type { ShareLinkMissKind } from "@/components/ShareLinkNotFound";

function App() {
  const [storageLayouts, setStorageLayouts] = useState<
    StorageVisualizerProps[]
  >([]);

  // Set when a ?chainId=&address= share link cannot serve a cached layout,
  // so Landing shows the ShareLinkNotFound banner instead of failing silently.
  const [shareLinkMiss, setShareLinkMiss] = useState<
    { kind: ShareLinkMissKind; chainId: string; address: string } | undefined
  >(undefined);

  // Parse URL arguments
  const url = new URL(window.location.href);
  const chainId = url.searchParams.get("chainId");
  const address = url.searchParams.get("address");

  const [isCheckingCache, setIsCheckingCache] = useState(
    Boolean(chainId && address)
  );

  // Check if the storage is cached
  useEffect(() => {
    if (!chainId && !address) return;

    if (
      !chainId ||
      !address ||
      !/^\d+$/.test(chainId) ||
      !ethAddressSchema.safeParse(address).success
    ) {
      setShareLinkMiss({
        kind: "invalid",
        chainId: chainId ?? "",
        address: address ?? "",
      });
      setIsCheckingCache(false);
      return;
    }

    async function fetchCachedStorageLayout() {
      const miss = (kind: ShareLinkMissKind) =>
        setShareLinkMiss({ kind, chainId: chainId!, address: address! });
      try {
        const response = await fetch("/api/get_cached_storage_layout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId, address }),
        });
        if (!response.ok) {
          miss(response.status === 404 ? "not-cached" : "error");
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
              sourceAddress: data.sourceAddress,
              proxyInfo: data.proxyInfo,
            },
          ]);
        } else {
          miss("error");
        }
      } catch (error) {
        console.error(
          `Error fetching cached storage layout for chainId: ${chainId} and address: ${address}:`,
          error
        );
        miss("error");
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
        {isCheckingCache && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <Loader2 className="animate-spin h-16 w-16 text-green-500" />
          </div>
        )}
        {storageLayouts.length === 0 ? (
          <Landing
            notice={
              shareLinkMiss && (
                <ShareLinkNotFound
                  kind={shareLinkMiss.kind}
                  chainId={shareLinkMiss.chainId}
                  address={shareLinkMiss.address}
                  onDismiss={() => setShareLinkMiss(undefined)}
                />
              )
            }
          />
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
                    sourceAddress={storageLayout.sourceAddress}
                    proxyInfo={storageLayout.proxyInfo}
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
