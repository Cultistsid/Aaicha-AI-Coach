// ipcHandlers.ts

import { ipcMain, app, dialog, powerSaveBlocker } from "electron"
import { AppState } from "./main"
import {
  getSettings,
  saveSettings,
  AaichaSettings,
  getBackground,
  saveBackground,
  getInterviewMode,
  setInterviewMode,
  InterviewMode
} from "./Settings"
import fs from "fs"

let sttListenerCleanup: (() => void) | null = null

// Held while a listening session runs so macOS App Nap can't suspend audio
// processing mid-interview.
let sttPowerBlockerId: number | null = null

function releaseSttPowerBlocker(): void {
  if (sttPowerBlockerId !== null) {
    if (powerSaveBlocker.isStarted(sttPowerBlockerId)) {
      powerSaveBlocker.stop(sttPowerBlockerId)
    }
    sttPowerBlockerId = null
  }
}

export function initializeIpcHandlers(appState: AppState): void {
  // ----- Settings -----

  ipcMain.handle("settings:get", async () => getSettings())

  ipcMain.handle("background:get", async () => getBackground())

  ipcMain.handle("background:save", async (_event, text: string) => {
    try {
      saveBackground(text || "")
      appState.processingHelper.refreshBackground()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  })

  // Pick a .pdf / .docx / .txt / .md and return its extracted text.
  ipcMain.handle("background:import-file", async () => {
    const pickOpts: Electron.OpenDialogOptions = {
      title: "Import résumé",
      properties: ["openFile"],
      filters: [
        { name: "Documents", extensions: ["pdf", "docx", "txt", "md"] }
      ]
    }
    // Cast through `any` to dodge a stale TS overload pick — the runtime
    // returns OpenDialogReturnValue (Promise) on Electron 33.
    const win = appState.getMainWindow()
    const result: Electron.OpenDialogReturnValue = win
      ? await (dialog.showOpenDialog as any)(win, pickOpts)
      : await (dialog.showOpenDialog as any)(pickOpts)
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    const filePath = result.filePaths[0]
    const ext = filePath.toLowerCase().split(".").pop() || ""
    try {
      let text = ""
      if (ext === "pdf") {
        // Import from lib path to skip pdf-parse's debug-mode test-fixture
        // load, which 404s in packaged apps.
        const pdfParse = require("pdf-parse/lib/pdf-parse.js")
        const buf = await fs.promises.readFile(filePath)
        const parsed = await pdfParse(buf)
        text = parsed.text || ""
      } else if (ext === "docx") {
        const mammoth = require("mammoth")
        const buf = await fs.promises.readFile(filePath)
        const out = await mammoth.extractRawText({ buffer: buf })
        text = out.value || ""
      } else if (ext === "txt" || ext === "md") {
        text = await fs.promises.readFile(filePath, "utf8")
      } else {
        return {
          success: false,
          error: `Unsupported file type: .${ext}`
        }
      }
      // Trim runs of blank lines that PDFs love to emit.
      text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
      return { success: true, text, filename: filePath.split("/").pop() }
    } catch (err: any) {
      console.error("[background:import-file] parse failed:", err)
      return {
        success: false,
        error: err?.message || "Failed to read file"
      }
    }
  })

  ipcMain.handle(
    "settings:save",
    async (_event, settings: AaichaSettings) => {
      try {
        saveSettings(settings)
        // Force a fresh ClaudeHelper next call so it picks up the new key.
        appState.processingHelper.resetClaude()
        // STTHelper reads ADC at construction time — drop it too so a fresh
        // one is made next start.
        appState.stt?.stop()
        appState.stt = null
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) }
      } finally {
        releaseSttPowerBlocker()
      }
    }
  )

  ipcMain.handle(
    "update-content-dimensions",
    async (_event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle("delete-screenshot", async (_event, path: string) => {
    return appState.deleteScreenshot(path)
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      throw error
    }
  })

  ipcMain.handle("toggle-window", async () => {
    appState.toggleMainWindow()
  })

  // ----- Claude: chat + vision -----

  ipcMain.handle("claude:chat", async (_event, message: string) => {
    try {
      return await appState.processingHelper.getClaude().chat(message)
    } catch (err: any) {
      console.error("[claude:chat] failed:", err)
      throw err
    }
  })

  ipcMain.handle(
    "claude:analyze-image",
    async (_event, imagePath: string, userPrompt?: string) => {
      try {
        return await appState.processingHelper
          .getClaude()
          .analyzeImageFile(imagePath, userPrompt)
      } catch (err: any) {
        console.error("[claude:analyze-image] failed:", err)
        throw err
      }
    }
  )

  // ----- Claude: live coaching (Listening Mode) -----

  ipcMain.handle("coach:reset", async () => {
    appState.processingHelper.getClaude().resetCoach()
    return { success: true }
  })

  ipcMain.handle(
    "coach:turn",
    async (
      _event,
      turnId: string,
      transcript: string,
      attachedImagePath?: string
    ) => {
      const win = appState.getMainWindow()
      const send = (channel: string, payload: any) => {
        if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
      }
      try {
        const claude = appState.processingHelper.getClaude()

        // Optional attached screenshot, captured via ⌘⇧V earlier.
        let image: { base64: string; mediaType: "image/png" } | undefined
        if (attachedImagePath && fs.existsSync(attachedImagePath)) {
          const buf = await fs.promises.readFile(attachedImagePath)
          image = { base64: buf.toString("base64"), mediaType: "image/png" }
        }

        const reply = await claude.coachTurn(
          transcript,
          (delta) => send("coach:delta", { turnId, text: delta }),
          image
        )
        send("coach:done", { turnId, text: reply })
        return { success: true, text: reply }
      } catch (err: any) {
        console.error("[coach:turn] failed:", err)
        send("coach:error", { turnId, error: err?.message || String(err) })
        return { success: false, error: err?.message || String(err) }
      }
    }
  )

  // ----- Google Speech-to-Text (Listening Mode) -----

  ipcMain.handle("stt:start", async () => {
    try {
      const stt = appState.getOrCreateSTT()
      if (sttListenerCleanup) {
        sttListenerCleanup()
        sttListenerCleanup = null
      }
      sttListenerCleanup = stt.on((event) => {
        const win = appState.getMainWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send("stt:event", event)
        }
      })
      stt.start()
      if (sttPowerBlockerId === null) {
        sttPowerBlockerId = powerSaveBlocker.start("prevent-app-suspension")
      }
      return { success: true }
    } catch (err: any) {
      console.error("[stt:start] failed:", err)
      return { success: false, error: err?.message || String(err) }
    }
  })

  ipcMain.on("stt:audio", (_event, base64Pcm: string) => {
    try {
      const buf = Buffer.from(base64Pcm, "base64")
      appState.stt?.writeAudio(buf)
    } catch (err) {
      console.error("[stt:audio] error:", err)
    }
  })

  ipcMain.handle("stt:stop", async () => {
    try {
      if (sttListenerCleanup) {
        sttListenerCleanup()
        sttListenerCleanup = null
      }
      appState.stt?.stop()
      releaseSttPowerBlocker()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  })

  // ----- Interview Mode -----

  ipcMain.handle("interview:getMode", async () => getInterviewMode())

  ipcMain.handle("interview:setMode", async (_event, mode: InterviewMode) => {
    setInterviewMode(mode)
    return { success: true }
  })

  // ----- Overlay mode -----

  ipcMain.handle("overlay:get", async () => ({
    active: appState.isOverlayActive()
  }))

  ipcMain.handle("overlay:toggle", async () => {
    appState.toggleOverlay()
    return { active: appState.isOverlayActive() }
  })

  ipcMain.handle("overlay:set", async (_event, active: boolean) => {
    appState.setOverlay(!!active)
    return { active: appState.isOverlayActive() }
  })

  // ----- Stealth mode (hide from screen capture) -----

  ipcMain.handle("stealth:get", async () => ({
    active: appState.isStealthActive()
  }))

  ipcMain.handle("stealth:toggle", async () => {
    const active = appState.toggleStealth()
    return { active }
  })

  ipcMain.handle("stealth:set", async (_event, active: boolean) => {
    appState.setStealthMode(!!active)
    return { active: appState.isStealthActive() }
  })

  // ----- Misc -----

  ipcMain.handle("claude:test", async () => {
    return appState.processingHelper.getClaude().testConnection()
  })

  ipcMain.handle("quit-app", () => {
    app.quit()
  })

  // Window movement handlers
  ipcMain.handle("move-window-left", async () => appState.moveWindowLeft())
  ipcMain.handle("move-window-right", async () => appState.moveWindowRight())
  ipcMain.handle("move-window-up", async () => appState.moveWindowUp())
  ipcMain.handle("move-window-down", async () => appState.moveWindowDown())
  ipcMain.handle("center-and-show-window", async () =>
    appState.centerAndShowWindow()
  )
}
