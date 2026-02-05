# PSI Testing Tool for Core Web Vitals

A simple Node.js tool to test and validate Core Web Vitals (CLS, LCP, FID) and performance scores using Google's PageSpeed Insights API.

**Perfect for:** Fixing CLS issues, optimizing LCP, improving FID, monitoring performance scores, validating Core Web Vitals compliance, working with Cursor AI to fix web performance issues.

**Key Feature:** Validation mode runs tests 3 times at 45-second intervals to ensure your fix is **consistently good**, not just a lucky one-time result.

**What It Tests:**
- ✅ **CLS** (Cumulative Layout Shift) - Layout stability
- ✅ **LCP** (Largest Contentful Paint) - Loading performance
- ✅ **FID** (First Input Delay) - Interactivity
- ✅ **Performance Score** - Overall page performance (0-100)
- ✅ Plus: FCP, SI, TBT, TTI

---

## Quick Setup (2 Minutes)

### 1. Get a Google API Key

Get your free API key: https://developers.google.com/speed/docs/insights/v5/get-started

### 2. Create Your Config File

```bash
cd ~/Documents/repositories/psi-testing-tool

# Copy the example config
cp config.json.example config.json

# Edit and add your API key
nano config.json
```

Replace `YOUR_GOOGLE_API_KEY_HERE` with your actual key:

```json
{
  "apiKey": "YOUR_ACTUAL_API_KEY_HERE",
  "thresholds": { ... },
  ...
}
```

**Note:** `config.json` is gitignored - your API key stays private!

### 3. Done! Ready to test

```bash
npm start
```

---

## Usage - Two Easy Ways

### 1️⃣ Quick Test (Command Line) ⚡

Test any URL instantly without editing files:

```bash
# Single URL (mobile by default)
node index.js https://your-site.com/page

# Multiple URLs
node index.js https://site1.com https://site2.com https://site3.com

# Test desktop instead of mobile
node index.js --desktop https://your-site.com/page

# Test BOTH mobile and desktop
node index.js --both https://your-site.com/page
```

**Best for:** One-off tests, quick checks during development

### 2️⃣ Text File (⭐ Recommended for Multiple URLs)

Create `urls.txt` with one URL per line:

```bash
cp urls.txt.example urls.txt
nano urls.txt
```

Example `urls.txt`:
```
# Production URLs
https://mysite.com/homepage
https://mysite.com/product-page
https://mysite.com/checkout

# Comments start with #
```

Then run:
```bash
# Test mobile (default)
npm start

# Test desktop
npm start -- --desktop

# Test BOTH mobile and desktop
npm start -- --both
```

**Best for:** Testing multiple pages, ongoing monitoring, non-technical users

**Priority:** Command-line URLs > `urls.txt`

---

### Strategy Flags

- **No flag** = Mobile (default)
- `--mobile` = Mobile (explicit)
- `--desktop` = Desktop only
- `--both` = Test each URL on both mobile AND desktop

When using `--both`, each URL is tested twice (mobile first, then desktop).

---

## Validation Mode (⭐ Recommended for Core Web Vitals Fixes)

**Problem:** PSI scores fluctuate. One test might show CLS 0.08 (good), next shows 0.12 (bad).  
**Solution:** Run 3 tests to ensure consistency across all metrics.

```bash
npm run validate
```

**What it does:**
1. Tests each URL
2. Waits 45 seconds
3. Tests again
4. Waits 45 seconds
5. Tests a third time
6. Shows all 3 results + average
7. **Exit code 0** if all pass ✅, **exit code 1** if any fail ❌

**Example output:**
```
▶ RUN 1/3
  Testing: Program Detail Page...
  CLS: 0.027 ✅ GOOD
  Performance: 100/100 ✅ GOOD

⏳ Waiting 45 seconds...

▶ RUN 2/3
  CLS: 0.023 ✅ GOOD

▶ RUN 3/3
  CLS: 0.031 ✅ GOOD

📊 VALIDATION SUMMARY
Average CLS: 0.027 (min: 0.023, max: 0.031)
✅ VALIDATION PASSED
```

Perfect for validating fixes before creating a PR!

---

## Using with Cursor AI (Complete Workflow)

This tool was designed to work seamlessly with Cursor AI for fixing any Core Web Vitals issue. Here's how:

### Step 1: Identify the Problem

Test your pages to find performance issues:

```bash
npm start
```

Note which metric is failing (CLS, LCP, FID, or Performance Score) and any culprit elements.

### Step 2: Prompt Cursor

Open your project in Cursor and provide this information:

**Example 1: CLS Issue**
```
I have a CLS issue on [TEMPLATE_NAME] template pages.

PSI Results (Mobile):
- Current CLS: 0.213 (POOR) - threshold is 0.1
- Culprit element: <div class="columns-wrapper">
- URL: https://branch--site--repo.aem.page/page-url

Requirements:
- Fix should be in template-specific files: templates/[name]/[name].css or .js
- Avoid changing global files unless necessary
- I'll validate with: npm run validate

Please:
1. Analyze why the layout shifts
2. Implement a fix
3. Explain what you changed
```

**Example 2: LCP Issue**
```
I have an LCP issue on [TEMPLATE_NAME] template pages.

PSI Results (Mobile):
- Current LCP: 3.8s (POOR) - threshold is 2.5s
- Main element: Hero image loading slowly
- URL: https://branch--site--repo.aem.page/page-url

Please optimize image loading to improve LCP below 2.5s.
```

**Example 3: Performance Score**
```
Performance score is 65/100 on [TEMPLATE_NAME] pages.

Issues identified by PSI:
- LCP: 2.8s
- CLS: 0.15
- TBT: 450ms

Please analyze and fix the main bottlenecks.
```

### Step 3: Review & Push

After Cursor implements the fix:

```bash
git add .
git commit -m "fix(CLS): reserve space for hero section on program-detail"
git push origin your-branch
```

### Step 4: Wait for Deployment

AEM needs time to rebuild your branch:

```bash
sleep 45  # Wait 45 seconds
```

### Step 5: Validate the Fix

```bash
cd ~/Documents/repositories/psi-testing-tool
npm run validate
```

### Step 6: Check Results

- **✅ All green (exit code 0)** → Fix validated! Create your PR.
- **❌ Some red (exit code 1)** → Needs more work. Go back to Cursor with new data.

If validation fails:
```
Validation failed. Results:
Run 1: CLS 0.089
Run 2: CLS 0.121 ❌
Run 3: CLS 0.095

PSI shows the culprit is now: <div class="hero-image">

Can you try a different approach? Maybe we need to reserve space earlier in the page load.
```

Repeat until all 3 runs pass consistently.

---

## Common Use Cases & Examples

### Quick Check During Development

```bash
# Mobile (default)
node index.js https://staging.mysite.com/new-feature

# Desktop
node index.js --desktop https://staging.mysite.com/new-feature

# Both
node index.js --both https://staging.mysite.com/new-feature
```

### Test Multiple Pages

```bash
# Create urls.txt
echo "https://mysite.com/page1
https://mysite.com/page2
https://mysite.com/page3" > urls.txt

# Test mobile (default)
npm start

# Test both mobile and desktop
npm start -- --both
```

### Before/After Comparison

```bash
# Before fix
node index.js https://main--site.com/page > before.txt

# After fix (on your branch)
node index.js https://branch--site.com/page > after.txt

# Compare
diff before.txt after.txt
```

### Test with Detailed Information

```bash
node index.js --detailed https://your-site.com
```

Shows which specific elements are causing layout shifts.

### Test Desktop Performance

```bash
# Desktop only
npm start -- --desktop

# Or command-line
node index.js --desktop https://your-site.com
```

### Test Both Mobile and Desktop

```bash
# Each URL tested twice (mobile + desktop)
npm start -- --both

# With validation (3 runs × 2 strategies = 6 tests per URL)
npm run validate -- --both
```

### Watch Mode (Continuous Testing)

```bash
node index.js --watch https://staging.mysite.com
```

Tests every 60 seconds. Good for monitoring during active development.

### Shell Aliases (Time Savers)

Add to `~/.zshrc` or `~/.bashrc`:

```bash
alias psi='cd ~/Documents/repositories/psi-testing-tool && node index.js'
alias psiv='cd ~/Documents/repositories/psi-testing-tool && npm run validate'
```

Usage:
```bash
psi https://mysite.com/page
psiv
```

---

## Configuration

### Thresholds

Edit `config.json` to customize what's considered "good":

```json
{
  "thresholds": {
    "cls": 0.1,        // Good if < 0.1
    "lcp": 2500,       // Good if < 2500ms
    "fid": 100,        // Good if < 100ms
    "performance": 90  // Good if >= 90
  }
}
```

**Google's Web Vitals:**
- **CLS:** < 0.1 = Good, 0.1-0.25 = Needs Improvement, > 0.25 = Poor
- **LCP:** < 2.5s = Good, 2.5-4s = Needs Improvement, > 4s = Poor
- **Performance:** >= 90 = Good, 50-89 = Average, < 50 = Poor

### Validation Settings

```json
{
  "validation": {
    "runs": 3,                // How many times to test each URL
    "intervalSeconds": 45,    // Wait time between test runs
    "requireAllPass": true    // Exit code 1 if any run fails
  }
}
```

**Use validation mode when:**
- Fixing CLS issues (scores can vary)
- Optimizing LCP (loading times fluctuate)
- Verifying performance improvements
- Before creating a PR
- In CI/CD pipelines

### Options

```json
{
  "options": {
    "saveResults": true,           // Save to results/ directory
    "resultsDir": "./results",     // Where to save
    "verbose": false               // Show extra debug info
  }
}
```

---

## Troubleshooting

### "Missing script: start"
**Solution:** Run `npm install` first to set up npm scripts.

### "ENOTFOUND www.googleapis.com"
**Solution:** You're in a restricted network. Try different WiFi or VPN.

### "Error: Invalid API key"
**Solution:** 
1. Check your key in `config.json`
2. Verify it's enabled for PageSpeed Insights API
3. Regenerate at: https://console.cloud.google.com/apis/credentials

### "No URLs configured"
**Solution:** Add URLs using one of the three methods (command-line, urls.txt, or config.json).

### URLs must start with http:// or https://
✅ Good: `https://example.com`, `http://localhost:3000`  
❌ Bad: `example.com`, `www.example.com`

### Inconsistent validation results (0.05, 0.15, 0.08)
**This is normal** for scores near the threshold. If average is good but variance is high, the fix might need refinement. Aim for all 3 runs to pass.

### Can't test localhost?
PSI only tests public URLs. Deploy to a staging/branch URL first, then test.

### API rate limits
Google PSI free tier: **400 requests/minute**, **25,000/day**

Each validation uses 3 requests per URL. If you hit limits, wait a few minutes.

---

## Real-World Success Stories

### Example 1: CLS Fix
**Project:** AEM EDS (extweb-academy)  
**Problem:** CLS 0.213 on program-detail pages (mobile) - failing Core Web Vitals  
**Root Cause:** Template CSS loading too late (`loadLazy()` instead of `loadEager()`)  
**Solution:** Modified `scripts/scripts.js` to load CSS in `loadEager()` for program-detail template  
**Result:** CLS 0.027 (89% improvement ✅), Performance 100/100  
**Validation:** All 3 runs passed consistently  
**Time to Fix:** ~30 minutes using this workflow with Cursor AI

### The Tool Works For All Core Web Vitals
- ✅ **CLS fixes** - Reserve space, prevent layout shifts
- ✅ **LCP optimization** - Image optimization, lazy loading, preloading
- ✅ **FID improvements** - Code splitting, defer non-critical JS
- ✅ **Performance score** - Overall optimization and best practices

---

## Command Reference

```bash
# Single test (uses urls.txt, mobile by default)
npm start

# Test desktop
npm start -- --desktop

# Test both mobile and desktop
npm start -- --both

# Test specific URL
node index.js https://your-site.com/page

# Test multiple URLs from command line
node index.js https://site1.com https://site2.com

# Test desktop from command line
node index.js --desktop https://your-site.com

# Test both mobile and desktop from command line
node index.js --both https://your-site.com

# Validation mode (3 runs, 45s intervals)
npm run validate

# Validation with both mobile and desktop
npm run validate -- --both

# Detailed mode (shows culprit elements)
node index.js --detailed https://your-site.com

# Watch mode (continuous testing every 60s)
node index.js --watch https://your-site.com

# View saved results
ls -lt results/
cat results/psi-results-[timestamp].json
```

---

## Sharing with Your Team

### Add to Your Project Repository

```bash
# In your project root
mkdir -p tools
cp -r ~/Documents/repositories/psi-testing-tool tools/

# Add to git
echo "tools/psi-testing-tool/results/" >> .gitignore
echo "tools/psi-testing-tool/urls.txt" >> .gitignore

git add tools/psi-testing-tool
git commit -m "docs: add PSI testing tool for CLS validation"
git push
```

Each team member should:
1. Clone/pull the repo
2. Get their own Google API key
3. Add it to `tools/psi-testing-tool/config.json`
4. Start testing!

---

## Technical Details

**How it works:**
1. Reads URLs from command-line, `urls.txt`, or `config.json`
2. Calls Google PageSpeed Insights API
3. Google runs Lighthouse on their servers
4. Parses CLS, LCP, Performance scores from response
5. Applies thresholds and formats output
6. Saves results to `results/` directory

**Dependencies:** None! Uses only Node.js built-ins (`https`, `fs`, `path`)

**Exit Codes:**
- `0` = All tests passed (good for CI/CD pipelines)
- `1` = Some tests failed or error occurred

**API Limits:** 25,000 requests/day (free tier)

**Files Structure:**
```
psi-testing-tool/
├── index.js              # Main tool
├── package.json          # NPM scripts
├── config.json.example   # Config template (commit this)
├── config.json           # Your config & API key (gitignored)
├── urls.txt.example      # URL template (commit this)
├── urls.txt              # Your URLs (gitignored)
├── README.md             # This file
└── results/              # Auto-saved test results (gitignored)
```

**Security:** `config.json` and `urls.txt` are gitignored to protect your API key and private URLs.

---

## FAQ

**Q: Why does it take so long?**  
A: Each PSI test runs a full Lighthouse audit on Google's servers. Takes 30-60 seconds per URL. Validation mode multiplies this by 3.

**Q: Can I test localhost?**  
A: No, PSI only tests public URLs. Deploy to a staging URL first.

**Q: What if scores fluctuate wildly?**  
A: That's why validation mode exists! Run 3 tests to get a reliable average. If variance is high, the page might have intermittent issues. This is especially common for CLS and LCP.

**Q: Can I test desktop instead of mobile?**  
A: Yes, use `--desktop` flag: `npm start -- --desktop` or `node index.js --desktop https://url.com`

**Q: Do I need to wait 45 seconds between tests?**  
A: Yes, for validation mode. This ensures Google's cache is refreshed and you get fresh measurements each time.

**Q: Can I use this in CI/CD?**  
A: Yes! The tool exits with code 0 (pass) or 1 (fail), perfect for automated pipelines.

---

**Made with ❤️ for Core Web Vitals optimization**  
**Created:** February 2026  
**Status:** Production-ready ✅  
**Focus:** CLS, LCP, FID, Performance Score

**Need help?** Open an issue or check the code - it's simple and well-commented!
