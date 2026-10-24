# Devin AI - Actual Usage Guide

## You're Logged In ✅

- **Account**: siddheyav2@gmail.com
- **Plan**: Devin Max (premium)
- **Models**: 836 available (including SWE-2 free models)

---

## How to Actually Use Devin

### 1. Trust This Directory (First Time Only)

Devin will ask to trust the project directory. **Say YES**.

```bash
cd /Users/cultistsid/Documents/Personal\ Projects/Aaicha
devin
# It will ask: "Trust ~/Documents/Personal Projects/Aaicha?"
# Type: y
```

### 2. Run Devin Commands

**Security Review**:
```bash
devin -- "Review electron/ClaudeHelper.ts for security vulnerabilities. Focus on API key handling and data leaks."
```

**Code Quality Check**:
```bash
devin -- "Analyze electron/STTHelper.ts for potential memory leaks in stream management."
```

**Test Suggestions**:
```bash
devin -- "Look at tests/unit/electron/ClaudeHelper.test.ts and suggest 3 critical missing test cases."
```

**Full Project Analysis**:
```bash
devin -- "Analyze this Electron app for security issues. Check: API keys, IPC validation, XSS risks."
```

---

## For Hackathon Demo

### Option A: Live Devin Demo (Most Impressive)

1. **Show Devin in action**:
   ```bash
   devin -- "Review the coach buffering logic in ListeningMode.tsx. Is there a race condition?"
   ```

2. **Let Devin find a real issue** (impressive for judges)
3. **Show the conversation** - Devin will ask questions, make suggestions

### Option B: Pre-Generated Report (Safer)

Run these BEFORE the demo and save output:

```bash
# Generate security report
devin -- "Security audit of this Electron interview coach app. List top 5 concerns." > devin-security-report.txt

# Generate code quality report  
devin -- "Code quality analysis. What are the 3 biggest technical debt items?" > devin-quality-report.txt

# Test coverage suggestions
devin -- "Review test coverage. What critical paths are missing tests?" > devin-tests-report.txt
```

Then show these files during presentation.

---

## What Devin Does Best

✅ **Security Reviews** - Finds API key leaks, XSS, injection risks  
✅ **Code Quality** - Suggests refactors, finds bugs  
✅ **Test Generation** - Writes missing test cases  
✅ **Architecture Review** - Validates design decisions  
✅ **Bug Fixing** - Actually writes code to fix issues  

---

## Quick Demo Script for Judges

```bash
# 1. Show you're logged in
devin auth status

# 2. Run a quick security check
devin -- "Quick security check on electron/ClaudeHelper.ts. Any API key exposure risks?"

# 3. Show the conversation
# Devin will respond with findings

# 4. Ask follow-up
# Type in the Devin session: "How would you fix that?"
```

---

## Models Available

**Free (included in Max plan)**:
- `swe-2-max` - Best for complex code analysis
- `swe-2-high` - Fast security reviews  
- `swe-2-medium` - Quick checks

**Premium**:
- `claude-opus-5-5` - Most capable
- `claude-sonnet-5-5` - Balanced (what I am)

---

## For the Hackathon Pitch

**"We used Devin AI for security auditing and code quality"**

Then show:
1. `devin auth status` (proves you're using it)
2. Pre-saved report files (the analysis results)
3. Or run it live if you're confident

---

## Troubleshooting

**"Trust this directory?"** → Type `y`  
**Session hangs** → Ctrl+C and try again  
**Want non-interactive mode** → Can't with current Devin CLI, save outputs instead  

---

## Next Step Boss Man

**Run this right now to test it**:

```bash
devin -- "Analyze electron/ClaudeHelper.ts for security issues. Be specific about API key handling."
```

It'll start an interactive session. Type your questions, get answers, Ctrl+C when done.

**That's real Devin usage. Fuck yeah.**
