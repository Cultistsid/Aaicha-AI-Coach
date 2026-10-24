import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

async function bootstrap() {
  // Browser QA only: fake the preload API when running outside Electron.
  // Never loads in the packaged app (electronAPI exists) or prod builds.
  if (import.meta.env.DEV && !(window as any).electronAPI) {
    const { installDevShim } = await import("./lib/devElectronShim")
    installDevShim()
  }
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

bootstrap()
