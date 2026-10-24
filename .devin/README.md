# Devin AI Integration - Aaicha Project

This project uses **Devin AI** for automated code analysis, security scanning, and intelligent code review as part of the hackathon requirements.

## Quick Start

### 1. Verify Devin CLI Installation
```bash
devin --version
```

If not installed:
```bash
curl -fsSL https://cli.devin.ai/install.sh | bash
export PATH="$HOME/.local/bin:$PATH"
```

### 2. Run Analysis
```bash
# Quick analysis of current changes
npm run devin:check

# Full codebase analysis
npm run devin:analyze

# Auto-fix issues (interactive)
npm run devin:fix
```

### 3. Enable Pre-Commit Hook
```bash
# Install the git hook
ln -sf ../../scripts/devin-pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Now Devin will automatically check your code before each commit.

## Features Enabled

### ✅ Code Quality Analysis
- TypeScript/JavaScript linting
- Best practices enforcement
- Dead code detection
- Complexity analysis

### ✅ Security Scanning
- API key leak detection
- Electron security checks (IPC validation, nodeIntegration)
- Dependency vulnerability scanning
- Input sanitization verification

### ✅ Performance Profiling
- Memory leak detection (especially STT streams)
- Event listener cleanup validation
- React re-render optimization suggestions

### ✅ AI-Powered Code Review
- Context-aware suggestions
- Interview coach quality checks
- Anthropic API usage best practices
- Google STT stream management

## Configuration

Main config: `.devin/config.json`

Key settings for this project:
```json
{
  "analysis": {
    "rules": {
      "code-quality": "high",
      "security": "high",      // Critical for API keys
      "performance": "medium"
    }
  },
  "ai-assist": {
    "focus-areas": [
      "api-key-security",      // ANTHROPIC_API_KEY protection
      "electron-security",     // IPC validation
      "rate-limiting",         // Claude API usage
      "memory-leaks"          // STT stream cleanup
    ]
  }
}
```

## Hackathon Demo Workflow

### Before Presenting
```bash
# 1. Run full quality check
npm run qa:full

# 2. Security audit
devin security-scan --critical-only

# 3. Generate metrics report
devin metrics --output hackathon-metrics.json
```

### Show Devin Integration
```bash
# Live demo: Make a deliberate bug, commit, and watch Devin catch it
echo "const apiKey = 'sk-ant-fake-key'" >> test-file.ts
git add test-file.ts
git commit -m "test"
# Devin will block the commit and flag the API key leak
```

## CI/CD Integration

Devin runs automatically in GitHub Actions (see `.github/workflows/devin-ci.yml`):

- ✅ On every PR: Quick analysis
- ✅ On main branch: Full scan + security audit
- ✅ Nightly: Deep performance profiling

## Commands Reference

| Command | Description |
|---------|-------------|
| `npm run devin:check` | Quick check of staged files |
| `npm run devin:analyze` | Full project analysis (JSON output) |
| `npm run devin:fix` | Interactive auto-fix mode |
| `devin security-scan` | Security-only audit |
| `devin perf-profile` | Performance profiling |
| `devin metrics` | Generate quality metrics report |

## Metrics Tracked

For hackathon presentation, Devin tracks:

- **Code Quality Score**: 0-100 (current: aim for >85)
- **Security Grade**: A-F (target: A)
- **Test Coverage**: % (target: >80% on core paths)
- **Technical Debt**: hours (minimize)
- **Performance Baseline**: ms/operation

Export metrics for demo:
```bash
devin metrics --output ./devin-report.json --format markdown
```

## Troubleshooting

### Devin not found
```bash
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

### Pre-commit hook not running
```bash
chmod +x .git/hooks/pre-commit
ls -la .git/hooks/pre-commit  # Should show executable bit
```

### False positives
Edit `.devin/config.json` to adjust thresholds or exclude specific rules.

## For Hackathon Judges

This project demonstrates Devin AI integration through:

1. **Automated Code Review**: Every commit is analyzed for quality and security
2. **Security-First Development**: API key leak detection, Electron security validation
3. **Performance Monitoring**: Real-time profiling of critical paths (STT, Claude API)
4. **Intelligent Suggestions**: Context-aware fixes for interview coach quality

**Live Demo Available**: We can show Devin catching bugs in real-time during the presentation.

---

**Devin Integration Status**: ✅ Fully Operational  
**Last Analysis**: Run `npm run devin:analyze` to update  
**Security Grade**: Run `devin security-scan` to check  
