import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Keep a clean light-mode baseline; ThemeProvider applies the signed-in user's palette.
try {
  document.documentElement.classList.remove("dark");
  document.documentElement.classList.remove("light");
  document.documentElement.removeAttribute("style");
} catch {}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
