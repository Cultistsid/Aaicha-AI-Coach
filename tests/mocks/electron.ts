import { vi } from 'vitest'

export const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn((channel: string, callback: Function) => {
    return mockIpcRenderer
  }),
  removeListener: vi.fn(),
  send: vi.fn()
}

export const mockIpcMain = {
  handle: vi.fn(),
  on: vi.fn(),
  removeHandler: vi.fn()
}

export const mockBrowserWindow = {
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  close: vi.fn(),
  isDestroyed: vi.fn().mockReturnValue(false),
  webContents: {
    send: vi.fn(),
    on: vi.fn()
  },
  on: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  setVisibleOnAllWorkspaces: vi.fn()
}

export const mockApp = {
  getPath: vi.fn((name: string) => `/mock/path/${name}`),
  whenReady: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn(),
  on: vi.fn()
}

export const mockDialog = {
  showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/mock/file.txt'] }),
  showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/mock/save.txt' }),
  showErrorBox: vi.fn()
}

vi.mock('electron', () => ({
  ipcRenderer: mockIpcRenderer,
  ipcMain: mockIpcMain,
  BrowserWindow: vi.fn(() => mockBrowserWindow),
  app: mockApp,
  dialog: mockDialog
}))
