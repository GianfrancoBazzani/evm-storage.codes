import StorageVisualizer from "@/components/StorageVisualizer";
import { useState } from "react";

function App() {
  const [storageLayout, setStorageLayout] = useState(["PEPESITO", "PEPE"]);

  return (
      <div className="flex flex-row gap-4">
        {storageLayout.map((contractName, index) => (
          <StorageVisualizer key={index} contractName={contractName} />
        ))}
      </div>
  );
}

export default App;
