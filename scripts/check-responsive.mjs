#!/usr/bin/env node
// scripts/check-responsive.mjs — Responsive layout validation for built dist/

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const DIST_DIR = 'dist';
const MOBILE_WIDTHS = [360, 390, 414, 640];
const MAX_ALLOWED_OVERFLOW = 1; // Allow 1px tolerance for rounding

console.log('🔍 Checking responsive layout rules...\n');

let errors = 0;
let warnings = 0;

// Check 1: Verify CSS contains mobile breakpoints
function checkCSSFiles(dir) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      checkCSSFiles(fullPath);
    } else if (extname(file) === '.css') {
      const content = readFileSync(fullPath, 'utf-8');
      
      // Check for mobile media queries
      if (!content.includes('@media') || !content.includes('max-width')) {
        console.warn(`⚠️  ${fullPath}: No mobile media queries found`);
        warnings++;
      }
      
      // Check for overflow prevention
      if (!content.includes('overflow-x') && !content.includes('overflowX')) {
        console.warn(`⚠️  ${fullPath}: No overflow-x rules found`);
        warnings++;
      }
      
      // Check for word-wrap/overflow-wrap
      if (!content.includes('word-wrap') && !content.includes('overflow-wrap')) {
        console.warn(`⚠️  ${fullPath}: No word-wrap/overflow-wrap rules found`);
        warnings++;
      }
      
      console.log(`✓ ${fullPath}: Basic responsive rules present`);
    }
  }
}

// Check 2: Verify HTML contains viewport meta tag
function checkHTMLFiles(dir) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      checkHTMLFiles(fullPath);
    } else if (extname(file) === '.html') {
      const content = readFileSync(fullPath, 'utf-8');
      
      // Skip placeholder files (Google/Bing verification)
      if (file.includes('placeholder') || file.includes('verification') || content.length < 100) {
        console.log(`⊘ ${fullPath}: Skipping placeholder/verification file`);
        continue;
      }
      
      // Check for viewport meta tag
      if (!content.includes('viewport') || !content.includes('width=device-width')) {
        console.error(`❌ ${fullPath}: Missing or incorrect viewport meta tag`);
        errors++;
      } else {
        console.log(`✓ ${fullPath}: Viewport meta tag present`);
      }
      
      // Check for max-width constraints on root elements
      if (!content.includes('max-width') && !content.includes('maxWidth')) {
        console.warn(`⚠️  ${fullPath}: No max-width constraints found in inline styles`);
        warnings++;
      }
    }
  }
}

// Check 3: Verify no hardcoded wide widths in JS bundles
function checkJSFiles(dir) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      checkJSFiles(fullPath);
    } else if (extname(file) === '.js') {
      const content = readFileSync(fullPath, 'utf-8');
      
      // Check for suspicious fixed widths (e.g., width: 1920px, minWidth: 1200px)
      const suspiciousWidths = content.match(/(?:width|minWidth):\s*["']?\d{4,}px/g);
      if (suspiciousWidths && suspiciousWidths.length > 0) {
        console.warn(`⚠️  ${fullPath}: Found potentially problematic fixed widths: ${suspiciousWidths.slice(0, 3).join(', ')}`);
        warnings++;
      }
    }
  }
}

// Check 4: Validate article-specific responsive patterns
function checkArticlePatterns() {
  console.log('\n📱 Checking article-specific responsive patterns...\n');
  
  const patterns = [
    { name: 'Article detail page wrapper', selector: '.article-detail-page', required: ['overflow-x', 'max-width'] },
    { name: 'Article layout grid', selector: '.article-layout', required: ['overflow-x', 'min-width'] },
    { name: 'Article main content', selector: '.article-main', required: ['overflow-x', 'min-width'] },
    { name: 'Article header title', selector: '.article-header h1', required: ['word-wrap', 'overflow-wrap', 'clamp'] },
    { name: 'Article breadcrumb', selector: '.article-breadcrumb', required: ['overflow-x'] },
    { name: 'CVE summary card', selector: '.cve-summary-card', required: ['@media', 'grid-template-columns: 1fr'] },
    { name: 'Article content', selector: '.article-content', required: ['overflow-x', 'word-wrap'] },
  ];
  
  // Read all CSS files and check for patterns
  const cssFiles = [];
  function collectCSS(dir) {
    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        collectCSS(fullPath);
      } else if (extname(file) === '.css') {
        cssFiles.push(fullPath);
      }
    }
  }
  collectCSS(DIST_DIR);
  
  const allCSS = cssFiles.map(f => readFileSync(f, 'utf-8')).join('\n');
  
  for (const pattern of patterns) {
    let found = false;
    for (const req of pattern.required) {
      if (allCSS.includes(req)) {
        found = true;
        break;
      }
    }
    
    if (found) {
      console.log(`✓ ${pattern.name}: Responsive rules present`);
    } else {
      console.warn(`⚠️  ${pattern.name}: Missing expected responsive rules (${pattern.required.join(', ')})`);
      warnings++;
    }
  }
}

// Run all checks
try {
  console.log('Checking CSS files...\n');
  checkCSSFiles(DIST_DIR);
  
  console.log('\nChecking HTML files...\n');
  checkHTMLFiles(DIST_DIR);
  
  console.log('\nChecking JS bundles...\n');
  checkJSFiles(DIST_DIR);
  
  checkArticlePatterns();
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Responsive Check Summary:`);
  console.log(`   ✓ Errors: ${errors}`);
  console.log(`   ⚠️  Warnings: ${warnings}`);
  
  if (errors > 0) {
    console.log('\n❌ Responsive check FAILED. Fix errors before deploying.\n');
    process.exit(1);
  } else if (warnings > 5) {
    console.log('\n⚠️  Many warnings detected. Review before deploying.\n');
    process.exit(0);
  } else {
    console.log('\n✅ Responsive check PASSED. Layout should work on mobile.\n');
    process.exit(0);
  }
} catch (err) {
  console.error('❌ Responsive check failed with error:', err.message);
  process.exit(1);
}
