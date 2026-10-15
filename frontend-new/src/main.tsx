import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Clean baseline mode
try {
  document.documentElement.classList.remove("dark");
  document.documentElement.classList.remove("light");
} catch {}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
