import { createContext, type Dispatch, type SetStateAction } from "react";

import type { StorageVisualizerProps } from "@/components/StorageVisualizer";

interface StorageLayoutsContextType {
  storageLayouts: StorageVisualizerProps[];
  setStorageLayouts: Dispatch<SetStateAction<StorageVisualizerProps[]>>;
}

export const StorageLayoutsContext = createContext<
  StorageLayoutsContextType | undefined
>(undefined);
