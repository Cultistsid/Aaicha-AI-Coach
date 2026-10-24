export interface AaichaSettings {
  anthropicApiKey?: string
  googleCloudProject?: string
  googleCloudLocation?: string
  claudeChatModel?: string
  claudeCoachModel?: string
}

export interface InterviewMode {
  type: 'case' | 'technical' | 'behavioral' | 'mixed'
  persona: 'partner' | 'manager' | 'senior-consultant'
  difficulty: 'intern' | 'analyst' | 'senior-analyst'
  company: 'deloitte' | 'generic'
}

export interface ElectronAPI {
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

  chat: (message: string) => Promise<string>
  analyzeImageFile: (
    path: string,
    userPrompt?: string
  ) => Promise<{ text: string; timestamp: number }>

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
    settings: AaichaSettings
  }>
  saveSettings: (
    settings: AaichaSettings
  ) => Promise<{ success: boolean; error?: string }>

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

  getInterviewMode: () => Promise<InterviewMode>
  setInterviewMode: (mode: InterviewMode) => Promise<{ success: boolean }>

  testConnection: () => Promise<{ success: boolean; error?: string }>

  sttStart: () => Promise<{ success: boolean; error?: string }>
  sttStop: () => Promise<{ success: boolean; error?: string }>
  sttSendAudio: (base64Pcm: string) => void
  onSTTEvent: (
    callback: (event: {
      kind: "status" | "interim" | "final"
      status?: "open" | "closed" | "error"
      message?: string
      text?: string
    }) => void
  ) => () => void

  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>
  quitApp: () => Promise<void>

  invoke: (channel: string, ...args: any[]) => Promise<any>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
