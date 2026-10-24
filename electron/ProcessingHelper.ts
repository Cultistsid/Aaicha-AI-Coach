import { AppState } from "./main"
import { ClaudeHelper } from "./ClaudeHelper"
import { getProductDocs } from "./Settings"

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
      this.claude.setProductDocs(getProductDocs())
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

  // Called when product docs change; live update without dropping history.
  public refreshProductDocs(): void {
    this.claude?.setProductDocs(getProductDocs())
  }

  // Vestigial — invoked by the Cmd+Enter / Cmd+R global shortcuts.
  public async processScreenshots(): Promise<void> {}
  public cancelOngoingRequests(): void {}
}
