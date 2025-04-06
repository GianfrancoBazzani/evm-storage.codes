import "@fontsource-variable/pixelify-sans";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Header } from "./components/Header";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <body className= "h-screen w-screen bg-black text-green-500 px-4">
      <Header />
      <App />
    </body>
  </StrictMode>
);
