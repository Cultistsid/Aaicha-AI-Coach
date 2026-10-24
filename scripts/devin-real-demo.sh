#!/bin/bash
# Real Devin Demo - Actually uses Devin AI agent
# Requires: devin auth login (run first)

set -e

echo "🤖 REAL DEVIN AI DEMO"
echo "===================="
echo ""

# Check if logged in
if ! devin auth status 2>&1 | grep -q "Logged in"; then
    echo "❌ Not logged in to Devin"
    echo ""
    echo "Run this first:"
    echo "   bash scripts/devin-real-login.sh"
    echo ""
    exit 1
fi

echo "✅ Authenticated with Devin AI"
echo ""

# Show what models are available
echo "📋 Available models:"
devin models 2>&1 | head -10
echo ""

echo "Starting Devin analysis tasks..."
echo ""

# Task 1: Security review
echo "Task 1: Security Review"
echo "-----------------------"
echo "Running: devin -- 'Review electron/ClaudeHelper.ts for security issues, especially API key handling'"
echo ""

devin electron/ClaudeHelper.ts -- "Review this file for security issues, focusing on API key handling and potential leaks. Keep response under 200 words." -p

echo ""
echo "---"
echo ""

# Task 2: Code quality check
echo "Task 2: Code Quality Check"
echo "--------------------------"
echo "Running: devin -- 'Review electron/STTHelper.ts for potential memory leaks'"
echo ""

devin electron/STTHelper.ts -- "Check this file for potential memory leaks, especially in stream handling and event listeners. List any issues found." -p

echo ""
echo "---"
echo ""

# Task 3: Test suggestions
echo "Task 3: Test Coverage Analysis"
echo "-------------------------------"
echo "Running: devin -- 'What additional tests should be added to ClaudeHelper?'"
echo ""

devin tests/unit/electron/ClaudeHelper.test.ts electron/ClaudeHelper.ts -- "Analyze the test file and implementation. What critical test cases are missing? List top 3." -p

echo ""
echo "================================"
echo "✅ REAL DEVIN DEMO COMPLETE"
echo "================================"
echo ""
echo "This used actual Devin AI to:"
echo "1. Review ClaudeHelper security"
echo "2. Check STTHelper for memory leaks"
echo "3. Suggest missing test cases"
echo ""
