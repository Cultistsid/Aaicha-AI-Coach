import { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
  testDir: './specs',
  timeout: 60000,
  retries: 1,
  workers: 1,
  use: {
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  reporter: [['html', { open: 'never' }], ['list']]
}

export default config
