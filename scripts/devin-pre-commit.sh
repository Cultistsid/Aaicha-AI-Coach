#!/bin/bash
# Devin AI pre-commit hook for Aaicha
# Runs quick analysis on staged files

set -e

echo "🤖 [Devin AI] Analyzing staged changes..."

# Get list of staged TypeScript/JavaScript files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
    echo "✅ No code files staged, skipping Devin analysis"
    exit 0
fi

# Run Devin on staged files only
echo "$STAGED_FILES" | xargs devin analyze --quick --format json > /tmp/devin-analysis.json 2>&1 || true

# Parse results
CRITICAL=$(jq -r '.issues[] | select(.severity == "critical") | .file' /tmp/devin-analysis.json 2>/dev/null | wc -l || echo 0)
HIGH=$(jq -r '.issues[] | select(.severity == "high") | .file' /tmp/devin-analysis.json 2>/dev/null | wc -l || echo 0)

if [ "$CRITICAL" -gt 0 ]; then
    echo "❌ Found $CRITICAL critical issues. Review before committing:"
    jq -r '.issues[] | select(.severity == "critical") | "  - \(.file):\(.line) - \(.message)"' /tmp/devin-analysis.json
    echo ""
    echo "Run 'npm run devin:fix' to auto-fix or 'git commit --no-verify' to bypass."
    exit 1
fi

if [ "$HIGH" -gt 0 ]; then
    echo "⚠️  Found $HIGH high-severity issues (warnings only):"
    jq -r '.issues[] | select(.severity == "high") | "  - \(.file):\(.line) - \(.message)"' /tmp/devin-analysis.json | head -5
    echo ""
fi

# Check for API key leaks
if echo "$STAGED_FILES" | xargs grep -l "ANTHROPIC_API_KEY\|sk-ant-" 2>/dev/null; then
    echo "❌ SECURITY: Potential API key exposure detected!"
    echo "Remove API keys before committing."
    exit 1
fi

echo "✅ Devin analysis passed"
exit 0
