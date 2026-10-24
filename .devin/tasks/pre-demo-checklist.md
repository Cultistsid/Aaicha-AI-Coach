# Pre-Demo Checklist for Devin AI

Run this checklist before hackathon demo/presentation.

## 1. Code Quality Check
```bash
npm run devin:analyze
```

## 2. Security Audit
```bash
devin security-scan --critical-only
```

## 3. Test Coverage Validation
```bash
npm run test:coverage
# Ensure core paths (ClaudeHelper, STTHelper, ProcessingHelper) are >80%
```

## 4. Performance Baseline
```bash
devin perf-profile --duration 60s
# Should complete coach turn in <2s average
# STT stream should reconnect in <500ms
```

## 5. Demo Scenario Test
```bash
npm run qa:full
```

## 6. API Key Verification
```bash
devin check-env
# Ensure ANTHROPIC_API_KEY and GOOGLE_APPLICATION_CREDENTIALS are set
```

## 7. Build Smoke Test
```bash
npm run build
npm run electron:build
# Verify app launches and coach responds
```

## Expected Outputs

✅ No critical security issues  
✅ Test coverage >80% on hot paths  
✅ Coach response latency <2s  
✅ STT reconnection <500ms  
✅ Zero API key leaks in logs  
✅ Clean production build  
