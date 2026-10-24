# Devin AI Integration - Hackathon Documentation

## Overview

Aaicha integrates **Devin AI** for intelligent code analysis, security scanning, and automated code review as a core hackathon requirement.

## Why Devin AI?

For a real-time AI interview coach handling sensitive data (audio, screenshots, API keys), automated code quality and security checks are critical:

- **Security**: Prevents API key leaks, validates Electron IPC, scans for vulnerabilities
- **Quality**: Enforces best practices for TypeScript, React, and Electron
- **Performance**: Detects memory leaks in long-running STT streams
- **Interview Coach Quality**: AI-powered suggestions for improving coach responses

## Quick Demo

```bash
# Run the hackathon demo (2 minutes)
npm run devin:demo
```

This shows Devin:
1. Analyzing current code quality
2. Running security scans
3. Catching intentional bugs in real-time
4. Blocking commits with critical issues

## Installation Verification

```bash
# Check if Devin is installed
npm run devin:status

# If not installed, run:
npm run devin:install
```

## Key Features Demonstrated

### 1. Pre-Commit Hook (Auto-blocks bad commits)

```bash
# Enable the hook
ln -sf ../../scripts/devin-pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Now try committing a file with an API key:
echo 'const key = "sk-ant-fake"' > test.ts
git add test.ts
git commit -m "test"
# ❌ Devin blocks the commit!
```

### 2. Security Scanning

```bash
npm run devin:security
```

Checks for:
- Hardcoded API keys (ANTHROPIC_API_KEY, Google credentials)
- Electron security issues (nodeIntegration, IPC validation)
- Dependency vulnerabilities
- Input sanitization gaps

### 3. Code Quality Analysis

```bash
npm run devin:analyze
```

Analyzes:
- TypeScript best practices
- React performance (unnecessary re-renders)
- Memory leaks (event listeners, timers, STT streams)
- Dead code detection

### 4. Metrics Report

```bash
npm run devin:metrics
```

Generates hackathon presentation metrics:
- Code Quality Score (0-100)
- Security Grade (A-F)
- Test Coverage %
- Technical Debt estimate
- Performance baselines

## Configuration

Main config: `.devin/config.json`

Hackathon-specific settings:
```json
{
  "hackathon": {
    "demo-mode": true,
    "metrics-tracking": true,
    "showcase-features": [
      "real-time-stt-coaching",
      "claude-api-integration",
      "interview-mode-customization"
    ]
  }
}
```

## CI/CD Integration

Devin runs automatically in GitHub Actions:

- **On PR**: Quick analysis + security scan
- **On main push**: Full deep scan
- **Nightly**: Performance profiling

See `.github/workflows/devin-ci.yml` for details.

## Hackathon Presentation Flow

### Before Demo (5 min setup)
```bash
# 1. Verify Devin works
npm run devin:status

# 2. Generate fresh metrics
npm run devin:metrics

# 3. Run full QA suite
npm run qa:full
```

### During Demo (Live)

**Option A: Show Devin catching bugs**
```bash
npm run devin:demo
# Runs automated demo showing bug detection
```

**Option B: Live coding with Devin**
1. Open `electron/ClaudeHelper.ts`
2. Intentionally add: `console.log(process.env.ANTHROPIC_API_KEY)`
3. Try to commit: `git add . && git commit -m "update"`
4. Watch Devin block it with security alert
5. Fix the issue and show Devin approving it

**Option C: Show metrics dashboard**
```bash
# Generate and display metrics
npm run devin:metrics
cat devin-metrics.json | jq '.summary'
```

### Talking Points for Judges

1. **"Devin AI is integrated at every layer"**
   - Pre-commit hooks prevent bad code from entering repo
   - CI/CD blocks merges with critical issues
   - Nightly scans catch performance regressions

2. **"Security-first for sensitive interview data"**
   - API key leak prevention
   - Electron IPC validation
   - Audio/screenshot data handling checks

3. **"AI coaching the AI coach"**
   - Devin suggests improvements to Claude prompts
   - Validates coach response quality
   - Ensures consistent interview mode behavior

4. **"Real-time metrics prove quality"**
   - Show current code quality score
   - Demonstrate test coverage >80%
   - Display security grade

## Files to Show Judges

1. **`.devin/config.json`** - Configuration showcasing focus areas
2. **`scripts/devin-pre-commit.sh`** - Pre-commit hook code
3. **`.github/workflows/devin-ci.yml`** - CI/CD integration
4. **`devin-metrics.json`** - Live quality metrics

## Common Commands

| Command | Use Case |
|---------|----------|
| `npm run devin:demo` | Full hackathon demo |
| `npm run devin:status` | Verify installation |
| `npm run devin:security` | Security-only scan |
| `npm run devin:metrics` | Generate presentation metrics |
| `npm run devin:check` | Quick pre-commit check |

## Troubleshooting

### "Devin command not found"
```bash
npm run devin:install
export PATH="$HOME/.local/bin:$PATH"
```

### Pre-commit hook not triggering
```bash
chmod +x .git/hooks/pre-commit
cat .git/hooks/pre-commit  # Should show devin-pre-commit.sh content
```

### Want to bypass Devin temporarily
```bash
git commit --no-verify -m "message"
# Use sparingly! Defeats the purpose.
```

## Metrics for Judges

Current project stats (run `npm run devin:metrics` for latest):

- **Code Quality**: Target >85/100
- **Security Grade**: Target A
- **Test Coverage**: >80% on critical paths
- **API Key Leak Detection**: 100% (zero tolerance)
- **Critical Issues**: Target 0
- **Build Time**: <30s for dev, <2min for production

## Integration Proof Points

✅ **Configured**: `.devin/config.json` with hackathon-specific rules  
✅ **Automated**: Pre-commit hook blocks bad code  
✅ **CI/CD**: GitHub Actions runs Devin on every PR  
✅ **Metrics**: Real-time quality dashboard  
✅ **Demo-ready**: `npm run devin:demo` shows live bug detection  

---

**For Hackathon Judges**: This integration demonstrates production-grade AI-assisted development with security and quality baked in from day one.

**Live Demo**: We can show Devin catching security bugs in real-time during the presentation.

**Metrics Dashboard**: Run `npm run devin:metrics` to see current quality score.
