import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ClerkProvider } from "@clerk/clerk-react"
import { BrowserRouter } from "react-router-dom"

import "./index.css"
import "mapbox-gl/dist/mapbox-gl.css"
import App from "./App.tsx"
import { UserSync } from "@/components/UserSync"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment.")
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <BrowserRouter>
        <ThemeProvider>
          <UserSync />
          <App />
          <Toaster />
        </ThemeProvider>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
)
