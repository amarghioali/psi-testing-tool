#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class PSITester {
  constructor(configPath = './config.json') {
    try {
      this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      if (!this.config.apiKey || this.config.apiKey === 'YOUR_GOOGLE_API_KEY_HERE') {
        console.error(`${colors.red}❌ Error: Please add your Google API key to config.json${colors.reset}`);
        console.log(`\nGet your API key from: ${colors.cyan}https://developers.google.com/speed/docs/insights/v5/get-started${colors.reset}\n`);
        process.exit(1);
      }
      
      this.results = [];
      this.args = process.argv.slice(2);
      this.detailed = this.args.includes('--detailed');
      this.watch = this.args.includes('--watch');
      this.validate = this.args.includes('--validate');
      
      // Parse strategy flags
      this.strategyMode = 'mobile'; // default
      if (this.args.includes('--desktop')) {
        this.strategyMode = 'desktop';
      } else if (this.args.includes('--both')) {
        this.strategyMode = 'both';
      } else if (this.args.includes('--mobile')) {
        this.strategyMode = 'mobile';
      }
      
      // Load URLs from different sources (priority order)
      this.loadUrls();
      
      // Validation settings
      this.validationConfig = this.config.validation || {
        runs: 3,
        intervalSeconds: 45,
        requireAllPass: true
      };
      
      this.allRuns = [];
      
    } catch (error) {
      console.error(`${colors.red}❌ Error loading config: ${error.message}${colors.reset}`);
      console.log('\nMake sure config.json exists in the current directory.\n');
      process.exit(1);
    }
  }

  loadUrls() {
    let baseUrls = [];
    let source = '';
    
    // Priority 1: Command-line URL argument
    const urlArgs = this.args.filter(arg => 
      !arg.startsWith('--') && (arg.startsWith('http://') || arg.startsWith('https://'))
    );
    
    if (urlArgs.length > 0) {
      baseUrls = urlArgs;
      source = 'command-line';
    } else {
      // Priority 2: urls.txt file
      const urlsFilePath = path.join(__dirname, 'urls.txt');
      if (fs.existsSync(urlsFilePath)) {
        try {
          const urlsContent = fs.readFileSync(urlsFilePath, 'utf8');
          const urls = urlsContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#')) // Skip empty lines and comments
            .filter(line => line.startsWith('http://') || line.startsWith('https://'));
          
          if (urls.length > 0) {
            baseUrls = urls;
            source = 'urls.txt';
          }
        } catch (error) {
          console.warn(`${colors.yellow}⚠️  Warning: Could not read urls.txt: ${error.message}${colors.reset}`);
        }
      }
    }
    
    // No URLs found
    if (baseUrls.length === 0) {
      console.error(`${colors.red}❌ Error: No URLs configured!${colors.reset}`);
      console.log(`\nYou can provide URLs in two ways:`);
      console.log(`  1. Command line: ${colors.cyan}node index.js https://example.com${colors.reset}`);
      console.log(`  2. Create urls.txt with one URL per line\n`);
      process.exit(1);
    }
    
    // Build URL configs based on strategy mode
    this.config.urls = [];
    
    if (this.strategyMode === 'both') {
      // Test each URL on both mobile and desktop
      baseUrls.forEach((url, index) => {
        this.config.urls.push({
          name: `URL ${index + 1} (Mobile)`,
          url: url,
          strategy: 'mobile'
        });
        this.config.urls.push({
          name: `URL ${index + 1} (Desktop)`,
          url: url,
          strategy: 'desktop'
        });
      });
    } else {
      // Test each URL with single strategy
      baseUrls.forEach((url, index) => {
        this.config.urls.push({
          name: `URL ${index + 1}`,
          url: url,
          strategy: this.strategyMode
        });
      });
    }
    
    // Display what we're using
    const strategyLabel = this.strategyMode === 'both' ? 'Mobile + Desktop' : 
                         this.strategyMode === 'desktop' ? 'Desktop' : 'Mobile';
    
    if (source === 'command-line') {
      console.log(`${colors.cyan}📌 Using URL(s) from command line [${strategyLabel}]${colors.reset}`);
    } else {
      console.log(`${colors.cyan}📄 Using URLs from urls.txt (${baseUrls.length} URL(s)) [${strategyLabel}]${colors.reset}`);
    }
    
    this.urlSource = source;
  }

  async testURL(urlConfig) {
    const { url, strategy = 'mobile', name } = urlConfig;
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&key=${this.config.apiKey}`;
    
    return new Promise((resolve, reject) => {
      https.get(apiUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            
            if (result.error) {
              reject(new Error(result.error.message));
              return;
            }
            
            const lighthouse = result.lighthouseResult;
            const audits = lighthouse.audits;
            
            const metrics = {
              name: name || url.split('/').pop(),
              url,
              strategy,
              timestamp: new Date().toISOString(),
              performance: Math.round(lighthouse.categories.performance.score * 100),
              cls: audits['cumulative-layout-shift'].numericValue,
              lcp: audits['largest-contentful-paint'].numericValue,
              fid: audits['max-potential-fid']?.numericValue || 0,
              fcp: audits['first-contentful-paint'].numericValue,
              si: audits['speed-index'].numericValue,
              tbt: audits['total-blocking-time'].numericValue,
              tti: audits['interactive'].numericValue,
            };
            
            if (this.detailed) {
              metrics.clsDetails = audits['cumulative-layout-shift'].details?.items || [];
              metrics.lcpDetails = audits['largest-contentful-paint'].details;
            }
            
            resolve(metrics);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  getStatus(value, threshold, inverse = false) {
    const pass = inverse ? value > threshold : value < threshold;
    if (pass) return `${colors.green}✅ GOOD${colors.reset}`;
    if (inverse ? value > threshold * 0.8 : value < threshold * 1.5) {
      return `${colors.yellow}⚠️  NEEDS IMPROVEMENT${colors.reset}`;
    }
    return `${colors.red}❌ POOR${colors.reset}`;
  }

  formatMetric(value, unit = 'ms') {
    if (unit === 'ms') return `${Math.round(value)}ms`;
    if (unit === 's') return `${(value / 1000).toFixed(2)}s`;
    return value.toFixed(3);
  }

  printResults(metrics) {
    const { name, url, performance, cls, lcp, fid, fcp, si, tbt, tti } = metrics;
    const thresholds = this.config.thresholds;
    
    console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}📊 ${name}${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    console.log(`\n${colors.bright}Performance Score:${colors.reset} ${performance}/100 ${this.getStatus(performance, thresholds.performance, true)}`);
    
    console.log(`\n${colors.bright}Core Web Vitals:${colors.reset}`);
    console.log(`  CLS: ${this.formatMetric(cls, 'unitless')} ${this.getStatus(cls, thresholds.cls)}`);
    console.log(`  LCP: ${this.formatMetric(lcp)} ${this.getStatus(lcp, thresholds.lcp)}`);
    console.log(`  FID: ${this.formatMetric(fid)} ${this.getStatus(fid, thresholds.fid)}`);
    
    console.log(`\n${colors.bright}Other Metrics:${colors.reset}`);
    console.log(`  FCP: ${this.formatMetric(fcp)}`);
    console.log(`  SI:  ${this.formatMetric(si)}`);
    console.log(`  TBT: ${this.formatMetric(tbt)}`);
    console.log(`  TTI: ${this.formatMetric(tti, 's')}`);
    
    if (this.detailed && metrics.clsDetails && metrics.clsDetails.length > 0) {
      console.log(`\n${colors.bright}CLS Details:${colors.reset}`);
      metrics.clsDetails.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.node?.snippet || 'Unknown element'}`);
      });
    }
  }

  saveResults() {
    if (!this.config.options.saveResults) return;
    
    const resultsDir = this.config.options.resultsDir || './results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(resultsDir, `psi-results-${timestamp}.json`);
    
    fs.writeFileSync(filename, JSON.stringify({
      timestamp: new Date().toISOString(),
      config: {
        thresholds: this.config.thresholds,
        urls: this.config.urls.map(u => ({ name: u.name, url: u.url }))
      },
      results: this.results
    }, null, 2));
    
    console.log(`\n${colors.green}💾 Results saved to: ${filename}${colors.reset}`);
  }

  sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async runValidation() {
    console.log(`\n${colors.bright}${colors.cyan}🔍 PSI Validation Mode (${this.validationConfig.runs} runs)${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    console.log(`Testing ${this.config.urls.length} URL(s) ${this.validationConfig.runs} times at ${this.validationConfig.intervalSeconds}s intervals\n`);
    
    for (let run = 1; run <= this.validationConfig.runs; run++) {
      console.log(`${colors.bright}${colors.yellow}▶ RUN ${run}/${this.validationConfig.runs}${colors.reset}`);
      
      if (run > 1) {
        console.log(`${colors.yellow}⏳ Waiting ${this.validationConfig.intervalSeconds} seconds...${colors.reset}`);
        await this.sleep(this.validationConfig.intervalSeconds);
      }
      
      this.results = [];
      
      for (const urlConfig of this.config.urls) {
        try {
          console.log(`\n  Testing: ${urlConfig.name}...`);
          const metrics = await this.testURL(urlConfig);
          metrics.run = run;
          this.results.push(metrics);
          
          // Show compact results
          console.log(`  ${colors.bright}CLS:${colors.reset} ${this.formatMetric(metrics.cls, 'unitless')} ${this.getStatus(metrics.cls, this.config.thresholds.cls)}`);
          console.log(`  ${colors.bright}Performance:${colors.reset} ${metrics.performance}/100 ${this.getStatus(metrics.performance, this.config.thresholds.performance, true)}`);
          
        } catch (error) {
          console.error(`  ${colors.red}❌ Error: ${error.message}${colors.reset}`);
          this.results.push({ 
            name: urlConfig.name, 
            url: urlConfig.url, 
            run,
            error: error.message 
          });
        }
      }
      
      this.allRuns.push([...this.results]);
      console.log('');
    }
    
    this.printValidationSummary();
  }

  printValidationSummary() {
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}📊 VALIDATION SUMMARY${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    
    const thresholds = this.config.thresholds;
    let allPassed = true;
    
    for (const urlConfig of this.config.urls) {
      const urlRuns = this.allRuns.map(run => 
        run.find(r => r.url === urlConfig.url)
      ).filter(Boolean);
      
      if (urlRuns.length === 0) continue;
      
      console.log(`${colors.bright}${urlConfig.name}${colors.reset}`);
      console.log(`  URL: ${colors.cyan}${urlConfig.url}${colors.reset}\n`);
      
      // CLS comparison
      const clsValues = urlRuns.filter(r => !r.error).map(r => r.cls);
      const clsAvg = clsValues.reduce((a, b) => a + b, 0) / clsValues.length;
      const clsMin = Math.min(...clsValues);
      const clsMax = Math.max(...clsValues);
      
      console.log(`  ${colors.bright}CLS Scores:${colors.reset}`);
      urlRuns.forEach((r, i) => {
        if (r.error) {
          console.log(`    Run ${i + 1}: ${colors.red}ERROR${colors.reset}`);
        } else {
          const status = r.cls < thresholds.cls ? colors.green + '✅' : colors.red + '❌';
          console.log(`    Run ${i + 1}: ${this.formatMetric(r.cls, 'unitless')} ${status}${colors.reset}`);
        }
      });
      
      if (clsValues.length > 0) {
        console.log(`  ${colors.bright}Average:${colors.reset} ${this.formatMetric(clsAvg, 'unitless')} (min: ${this.formatMetric(clsMin, 'unitless')}, max: ${this.formatMetric(clsMax, 'unitless')})`);
        
        const clsPassed = clsMax < thresholds.cls;
        console.log(`  ${colors.bright}CLS Result:${colors.reset} ${clsPassed ? colors.green + '✅ ALL RUNS PASS' : colors.red + '❌ SOME RUNS FAIL'}${colors.reset}`);
        
        if (!clsPassed) allPassed = false;
      }
      
      // Performance comparison
      const perfValues = urlRuns.filter(r => !r.error).map(r => r.performance);
      const perfAvg = perfValues.reduce((a, b) => a + b, 0) / perfValues.length;
      
      console.log(`\n  ${colors.bright}Performance Scores:${colors.reset}`);
      urlRuns.forEach((r, i) => {
        if (r.error) {
          console.log(`    Run ${i + 1}: ${colors.red}ERROR${colors.reset}`);
        } else {
          const status = r.performance >= thresholds.performance ? colors.green + '✅' : colors.yellow + '⚠️';
          console.log(`    Run ${i + 1}: ${r.performance}/100 ${status}${colors.reset}`);
        }
      });
      
      if (perfValues.length > 0) {
        console.log(`  ${colors.bright}Average:${colors.reset} ${Math.round(perfAvg)}/100`);
        
        const perfPassed = Math.min(...perfValues) >= thresholds.performance;
        console.log(`  ${colors.bright}Performance Result:${colors.reset} ${perfPassed ? colors.green + '✅ ALL RUNS PASS' : colors.yellow + '⚠️ SOME RUNS BELOW THRESHOLD'}${colors.reset}`);
      }
      
      console.log('');
    }
    
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    if (allPassed) {
      console.log(`${colors.bright}${colors.green}✅ VALIDATION PASSED - All URLs meet CLS threshold across all runs${colors.reset}`);
      console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.bright}${colors.red}❌ VALIDATION FAILED - Some URLs exceed CLS threshold${colors.reset}`);
      console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
      process.exit(1);
    }
  }

  async run() {
    if (this.validate) {
      return this.runValidation();
    }
    
    console.log(`\n${colors.bright}${colors.cyan}🔍 PageSpeed Insights Testing Tool${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    console.log(`Testing ${this.config.urls.length} URL(s)...`);
    if (this.detailed) console.log(`${colors.yellow}Detailed mode enabled${colors.reset}`);
    
    for (const urlConfig of this.config.urls) {
      try {
        console.log(`\n⏳ Testing: ${urlConfig.name}...`);
        const metrics = await this.testURL(urlConfig);
        this.results.push(metrics);
        this.printResults(metrics);
      } catch (error) {
        console.error(`\n${colors.red}❌ Error testing ${urlConfig.name}: ${error.message}${colors.reset}`);
      }
    }
    
    console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}${colors.green}✅ Testing Complete${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    
    // Summary
    const passed = this.results.filter(r => 
      r.cls < this.config.thresholds.cls && 
      r.lcp < this.config.thresholds.lcp && 
      r.performance >= this.config.thresholds.performance
    ).length;
    
    console.log(`${colors.bright}Summary:${colors.reset} ${passed}/${this.results.length} URLs passed all thresholds\n`);
    
    this.saveResults();
    
    if (this.watch) {
      console.log(`${colors.yellow}⏳ Waiting 60 seconds before next run...${colors.reset}\n`);
      setTimeout(() => {
        this.results = [];
        this.run();
      }, 60000);
    }
  }
}

// Run the tool
const tester = new PSITester();
tester.run().catch(console.error);
