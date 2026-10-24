#!/bin/bash
# Real Devin AI Login and Setup

set -e

echo "🤖 DEVIN AI - REAL LOGIN"
echo "========================"
echo ""

# Check if already logged in
if devin auth status 2>&1 | grep -q "Logged in"; then
    echo "✅ Already logged in to Devin"
    devin auth status
    exit 0
fi

echo "Starting Devin authentication..."
echo ""
echo "This will open your browser. If it doesn't:"
echo "1. Copy the URL that appears"
echo "2. Paste it in your browser"
echo "3. Login with your Devin account"
echo ""
echo "Press Enter to continue..."
read

# Start login flow
devin auth login

echo ""
echo "✅ Login complete!"
echo ""
echo "Verify authentication:"
devin auth status
echo ""
echo "Next steps:"
echo "1. Run: devin -- 'Review the ClaudeHelper.ts file for security issues'"
echo "2. Or: devin -- 'Add unit tests for the STTHelper class'"
echo "3. Or: npm run devin:real-demo"
