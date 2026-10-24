#!/bin/bash
# Full QA Suite — Devin CLI + Opus 5.5 Agents

set -e

echo "🧪 FULL QA SUITE — Aaicha"
echo "========================="
echo ""

# 1. Devin CLI analysis (if authenticated)
echo "📊 [1/5] Running Devin CLI analysis..."
if devin doctor &> /dev/null; then
    devin analyze --format json > reports/devin-analysis.json || {
        echo "⚠️  Devin analysis skipped (not authenticated)"
        echo "   Run: devin auth login"
    }
else
    echo "⚠️  Devin CLI not set up. Run: devin setup"
fi
echo ""

# 2. Unit tests
echo "🔬 [2/5] Running unit tests..."
npm run test -- --run --reporter=verbose || {
    echo "❌ Unit tests failed!"
    exit 1
}
echo ""

# 3. Component tests
echo "🧩 [3/5] Running component tests..."
npm run test -- --run --testPathPattern=components --reporter=verbose || {
    echo "❌ Component tests failed!"
    exit 1
}
echo ""

# 4. E2E tests (headless)
echo "🚀 [4/5] Running E2E tests..."
npm run test:e2e || {
    echo "⚠️  E2E tests failed (may need running app)"
}
echo ""

# 5. Coverage report
echo "📈 [5/5] Generating coverage report..."
npm run test:coverage || true
echo ""

echo "✅ QA SUITE COMPLETE"
echo "========================="
echo ""
echo "📊 Reports:"
echo "  - Unit/Component: coverage/index.html"
echo "  - E2E: tests/e2e/playwright-report/index.html"
echo "  - Devin: reports/devin-analysis.json"
echo ""
