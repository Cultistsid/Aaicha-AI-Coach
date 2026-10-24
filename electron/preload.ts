import { contextBridge, ipcRenderer } from "electron"

interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onResetView: (callback: () => void) => () => void

  takeScreenshot: () => Promise<{ path: string; preview: string }>

  // Claude — chat + vision
  chat: (message: string) => Promise<string>
  analyzeImageFile: (
    path: string,
    userPrompt?: string
  ) => Promise<{ text: string; timestamp: number }>

  // Claude — Listening Mode coach
  coachReset: () => Promise<{ success: boolean }>
  coachTurn: (
    turnId: string,
    transcript: string,
    attachedImagePath?: string
  ) => Promise<{ success: boolean; text?: string; error?: string }>
  onCoachScreenAttached: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onCoachDelta: (
    callback: (data: { turnId: string; text: string }) => void
  ) => () => void
  onCoachDone: (
    callback: (data: { turnId: string; text: string }) => void
  ) => () => void
  onCoachError: (
    callback: (data: { turnId: string; error: string }) => void
  ) => () => void

  getSettings: () => Promise<{
    configured: boolean
    envPath: string
    settings: {
      googleCloudProject?: string
      googleCloudLocation?: string
      claudeChatModel?: string
      claudeCoachModel?: string
    }
  }>
  saveSettings: (settings: {
    anthropicApiKey?: string
    googleCloudProject?: string
    googleCloudLocation?: string
    claudeChatModel?: string
    claudeCoachModel?: string
  }) => Promise<{ success: boolean; error?: string }>

  getBackground: () => Promise<string>
  saveBackground: (
    text: string
  ) => Promise<{ success: boolean; error?: string }>
  importBackgroundFile: () => Promise<{
    success: boolean
    canceled?: boolean
    text?: string
    filename?: string
    error?: string
  }>

  testConnection: () => Promise<{ success: boolean; error?: string }>

  // Overlay mode (translucent top-center coach view)
  getOverlay: () => Promise<{ active: boolean }>
  toggleOverlay: () => Promise<{ active: boolean }>
  setOverlay: (active: boolean) => Promise<{ active: boolean }>
  onOverlayState: (
    callback: (data: { active: boolean }) => void
  ) => () => void

  // Stealth mode (hide from screen capture)
  getStealth: () => Promise<{ active: boolean }>
  toggleStealth: () => Promise<{ active: boolean }>
  setStealth: (active: boolean) => Promise<{ active: boolean }>
  onStealthState: (
    callback: (data: { active: boolean }) => void
  ) => () => void

  // Speech-to-Text
  sttStart: () => Promise<{ success: boolean; error?: string }>
  sttStop: () => Promise<{ success: boolean; error?: string }>
  sttSendAudio: (base64Pcm: string) => void
  onSTTEvent: (callback: (event: any) => void) => () => void

  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>
  quitApp: () => Promise<void>

  invoke: (channel: string, ...args: any[]) => Promise<any>
}

const subscribe = <T>(channel: string, callback: (data: T) => void) => {
  const subscription = (_: unknown, data: T) => callback(data)
  ipcRenderer.on(channel, subscription)
  return () => {
    ipcRenderer.removeListener(channel, subscription)
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),

  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => subscribe("screenshot-taken", callback),

  onResetView: (callback: () => void) =>
    subscribe<unknown>("reset-view", () => callback()),

  // Claude
  chat: (message: string) => ipcRenderer.invoke("claude:chat", message),
  analyzeImageFile: (path: string, userPrompt?: string) =>
    ipcRenderer.invoke("claude:analyze-image", path, userPrompt),

  // Coach
  coachReset: () => ipcRenderer.invoke("coach:reset"),
  coachTurn: (
    turnId: string,
    transcript: string,
    attachedImagePath?: string
  ) => ipcRenderer.invoke("coach:turn", turnId, transcript, attachedImagePath),
  onCoachScreenAttached: (
    callback: (data: { path: string; preview: string }) => void
  ) => subscribe("coach:screen-attached", callback),
  onCoachDelta: (
    callback: (data: { turnId: string; text: string }) => void
  ) => subscribe("coach:delta", callback),
  onCoachDone: (
    callback: (data: { turnId: string; text: string }) => void
  ) => subscribe("coach:done", callback),
  onCoachError: (
    callback: (data: { turnId: string; error: string }) => void
  ) => subscribe("coach:error", callback),

  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: unknown) =>
    ipcRenderer.invoke("settings:save", settings),

  getBackground: () => ipcRenderer.invoke("background:get"),
  saveBackground: (text: string) =>
    ipcRenderer.invoke("background:save", text),
  importBackgroundFile: () => ipcRenderer.invoke("background:import-file"),

  testConnection: () => ipcRenderer.invoke("claude:test"),

  getOverlay: () => ipcRenderer.invoke("overlay:get"),
  toggleOverlay: () => ipcRenderer.invoke("overlay:toggle"),
  setOverlay: (active: boolean) => ipcRenderer.invoke("overlay:set", active),
  onOverlayState: (callback: (data: { active: boolean }) => void) =>
    subscribe("overlay:state", callback),

  // Stealth mode
  getStealth: () => ipcRenderer.invoke("stealth:get"),
  toggleStealth: () => ipcRenderer.invoke("stealth:toggle"),
  setStealth: (active: boolean) => ipcRenderer.invoke("stealth:set", active),
  onStealthState: (callback: (data: { active: boolean }) => void) =>
    subscribe("stealth:state", callback),

  getInterviewMode: () => ipcRenderer.invoke("interview:getMode"),
  setInterviewMode: (mode: any) => ipcRenderer.invoke("interview:setMode", mode),

  // STT
  sttStart: () => ipcRenderer.invoke("stt:start"),
  sttStop: () => ipcRenderer.invoke("stt:stop"),
  sttSendAudio: (base64Pcm: string) =>
    ipcRenderer.send("stt:audio", base64Pcm),
  onSTTEvent: (callback: (event: any) => void) =>
    subscribe("stt:event", callback),

  moveWindowLeft: () => ipcRenderer.invoke("move-window-left"),
  moveWindowRight: () => ipcRenderer.invoke("move-window-right"),
  moveWindowUp: () => ipcRenderer.invoke("move-window-up"),
  moveWindowDown: () => ipcRenderer.invoke("move-window-down"),
  quitApp: () => ipcRenderer.invoke("quit-app"),

  invoke: (channel: string, ...args: any[]) =>
    ipcRenderer.invoke(channel, ...args)
} as ElectronAPI)
