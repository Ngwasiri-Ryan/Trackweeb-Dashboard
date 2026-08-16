import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { Toaster } from "@/components/ui/sonner";
import { GoogleMapsProvider } from "@/components/maps/google-maps-shell";
import { ThemeProvider, themeInitScript } from "@/lib/theme";
import { ensureAppSetup } from "@/lib/ensure-setup";
import { brand } from "@/lib/brand";
import "./styles.css";

document.title = brand.adminTitle;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const script = document.createElement("script");
script.textContent = themeInitScript;
document.head.appendChild(script);

function renderApp() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <GoogleMapsProvider>
            <BrowserRouter>
              <App />
              <Toaster richColors position="top-right" />
            </BrowserRouter>
          </GoogleMapsProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

ensureAppSetup().finally(renderApp);
