#!/bin/bash
# Quick Devin AI check before commits

set -e

echo "🤖 Running Devin AI analysis..."

if ! command -v devin &> /dev/null; then
    echo "⚠️  Devin CLI not found. Installing..."
    curl -fsSL https://cli.devin.ai/install.sh | bash
fi

export PATH="$HOME/.local/bin:$PATH"

# Run Devin analysis on staged files
devin analyze --staged --quick || {
    echo "⚠️  Devin analysis found issues. Review above."
    exit 0  # Don't block commits, just warn
}

echo "✅ Devin check complete"
