# Devin Code Review Prompts for Aaicha

## Security Focus Areas

When reviewing code, prioritize:

1. **API Key Security**
   - Never log API keys (ANTHROPIC_API_KEY, GOOGLE_APPLICATION_CREDENTIALS)
   - Ensure keys are loaded from environment or secure storage only
   - Check for accidental key exposure in error messages

2. **Electron Security**
   - Validate all IPC messages (main ↔ renderer)
   - Sanitize user input before passing to child processes
   - No `nodeIntegration: true` without contextIsolation
   - Preload scripts must validate all exposed APIs

3. **STT Stream Management**
   - Check for memory leaks in long-running STT sessions
   - Ensure streams are properly closed on errors
   - Validate audio buffer sizes

4. **Claude API Usage**
   - Rate limiting on coachTurn calls
   - Token usage tracking
   - Graceful degradation on API errors
   - Prompt injection prevention

## Performance Checks

- Check for unnecessary re-renders in ListeningMode
- Ensure coach buffering logic doesn't leak timers
- Validate screenshot queue doesn't grow unbounded
- Check for unsubscribed event listeners

## Interview Coach Quality

- Verify coach system prompts match Deloitte context when configured
- Check that background injection works correctly
- Ensure history trimming preserves recent context
- Validate multimodal (text + image) coach turns
