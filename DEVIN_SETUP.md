# Devin CLI Setup Guide

## Installation

Devin CLI is already installed at `~/.local/bin/devin`.

```bash
devin --version
# devin 3000.11.205 (6dea39440ae3)
```

## Authentication

To use Devin CLI's analysis features, authenticate:

```bash
devin auth login
```

This will open a browser window for OAuth login.

## Usage

### Quick Check (Pre-commit)
```bash
npm run devin:check
```

Runs a fast analysis on staged files. Non-blocking — warns but doesn't fail.

### Full Analysis
```bash
npm run devin:analyze
```

Generates a detailed JSON report of code quality, potential bugs, and suggestions.

Output: `devin-report.json`

### Interactive Fix
```bash
npm run devin:fix
```

Opens an interactive mode where Devin suggests fixes and you can apply them one by one.

## CI/CD Integration

Devin runs automatically on every PR via GitHub Actions.

See: `.github/workflows/devin-review.yml`

The workflow:
1. Installs Devin CLI
2. Runs analysis on the PR diff
3. Uploads results as an artifact

## Tips

- **First run**: `devin setup` — interactive configuration wizard
- **Diagnose issues**: `devin doctor` — checks local setup
- **Cloud sessions**: `devin cloud` — run Devin in a cloud environment (paid feature)
- **Skills**: `devin skills list` — see available agent skills

## Integration with This Project

Devin is integrated at 3 levels:

1. **Local dev**: `npm run devin:check` before commits
2. **CI/CD**: GitHub Actions runs on every PR
3. **Scripts**: `scripts/devin-check.sh` — bash wrapper for custom workflows

## Troubleshooting

### "Login canceled"
Run `devin auth login` and complete the OAuth flow in your browser.

### "Command not found"
Add `~/.local/bin` to your PATH:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

### "Rate limit exceeded"
Devin has API rate limits on free tier. Upgrade or wait.

## Learn More

- [Devin CLI Docs](https://docs.devin.ai/cli)
- [GitHub Integration](https://docs.devin.ai/integrations/github)
- [Agent Skills](https://docs.devin.ai/skills)
