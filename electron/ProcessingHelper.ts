import { AppState } from "./main"
import { ClaudeHelper } from "./ClaudeHelper"
import { getBackground } from "./Settings"

export class ProcessingHelper {
  private appState: AppState
  private claude: ClaudeHelper | null = null

  constructor(appState: AppState) {
    this.appState = appState
  }

  public isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY
  }

  public getClaude(): ClaudeHelper {
    if (!this.claude) {
      this.claude = new ClaudeHelper()
      this.claude.setBackground(getBackground())
      console.log(
        `[ProcessingHelper] Using Claude (${this.claude.getCurrentModel()})`
      )
    }
    return this.claude
  }

  // Called after settings change so the next call reads the new env values.
  public resetClaude(): void {
    this.claude = null
  }

  // Called when the background changes; live update without dropping history.
  public refreshBackground(): void {
    this.claude?.setBackground(getBackground())
  }

  // Vestigial — invoked by the Cmd+Enter / Cmd+R global shortcuts.
  public async processScreenshots(): Promise<void> {}
  public cancelOngoingRequests(): void {}
}
