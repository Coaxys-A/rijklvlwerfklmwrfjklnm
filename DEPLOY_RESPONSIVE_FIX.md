# Deployment Guide: Mobile Responsive Fix

## Pre-Deployment Checklist

- [x] Build passes with responsive checks: `npm run build` ✅
- [x] No CDN dependencies introduced ✅
- [x] No breaking changes to existing functionality ✅
- [x] No backend/database changes required ✅
- [x] Zero downtime deployment possible ✅

## Changed Files

```
M  src/styles/global.css           (responsive CSS rules)
M  teknav-articles.jsx              (component overflow fixes + mobile CSS)
M  package.json                     (added check:responsive script)
A  scripts/check-responsive.mjs     (automated validation)
A  RESPONSIVE_FIX_SUMMARY.md        (documentation)
A  DEPLOY_RESPONSIVE_FIX.md         (this file)
```

## Local Testing (Before Deploy)

```bash
# 1. Build and verify
npm run build

# Expected output:
# ✅ Responsive check PASSED. Layout should work on mobile.

# 2. Preview locally
npm run preview

# 3. Test in browser at http://localhost:4173
# - Open DevTools
# - Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
# - Test widths: 360px, 390px, 414px, 640px
# - Navigate to: /article/cve-2026-41940-cpanel-zero-day-analysis
# - Verify: no horizontal scroll, title wraps, CVE card stacks
```

## Production Deployment (Linux)

### Step 1: Upload Code

```bash
# On your local machine (if using git)
git add src/styles/global.css teknav-articles.jsx package.json scripts/check-responsive.mjs
git commit -m "fix: mobile responsive layout for article pages

- Add overflow-x prevention on all article wrappers
- Implement word-wrap for long titles and technical terms
- Stack CVE summary cards vertically on mobile
- Add horizontal scroll for tables and code blocks
- Integrate automated responsive check in build pipeline
- Zero breaking changes, CSS/layout only"

git push origin main
```

### Step 2: Deploy on Server

```bash
# SSH into production server
ssh user@teknav.ir

# Navigate to app directory
cd /srv/teknav/app

# Pull latest changes
git pull origin main

# Install dependencies (if package.json changed)
npm ci

# Build with responsive checks
npm run build

# Expected output should end with:
# ✅ Responsive check PASSED. Layout should work on mobile.
```

### Step 3: Reload Nginx (Zero Downtime)

```bash
# Test nginx configuration
sudo nginx -t

# Expected output:
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload nginx (zero downtime)
sudo systemctl reload nginx

# Verify nginx is running
sudo systemctl status nginx
```

### Step 4: Verify Deployment

```bash
# Check if new assets are served
curl -I https://www.teknav.ir/ | grep "200 OK"

# Test article page
curl -I https://www.teknav.ir/article/cve-2026-41940-cpanel-zero-day-analysis | grep "200 OK"
```

## Post-Deployment Verification

### Browser Testing

1. Open https://www.teknav.ir/article/cve-2026-41940-cpanel-zero-day-analysis
2. Open DevTools (F12)
3. Toggle device toolbar (Ctrl+Shift+M)
4. Test these viewports:
   - iPhone SE (375px)
   - iPhone 12 Pro (390px)
   - Pixel 5 (393px)
   - Samsung Galaxy S20 (360px)
   - iPad Mini (768px)

### Validation Checklist

- [ ] Page loads without errors
- [ ] No horizontal scroll on any mobile width
- [ ] Article title wraps cleanly (no overflow)
- [ ] CVE summary card displays as single column
- [ ] Breadcrumb scrolls horizontally (not page)
- [ ] Meta row scrolls horizontally (not page)
- [ ] Tables scroll within their container
- [ ] Code blocks scroll within their container
- [ ] All buttons are tappable
- [ ] Text is readable at all sizes
- [ ] Desktop layout unchanged

### Performance Check

```bash
# Check bundle sizes (should be similar to before)
ls -lh dist/assets/*.css
ls -lh dist/assets/*.js

# Verify gzip sizes in build output
npm run build | grep "gzip:"
```

## Rollback Procedure (If Needed)

```bash
# On production server
cd /srv/teknav/app

# Revert to previous commit
git revert HEAD

# Rebuild
npm run build

# Reload nginx
sudo systemctl reload nginx
```

## Monitoring

After deployment, monitor:

1. **Error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Access logs:**
   ```bash
   sudo tail -f /var/log/nginx/access.log | grep "article/"
   ```

3. **Browser console errors:**
   - Open DevTools Console
   - Check for JavaScript errors
   - Check for CSS warnings

4. **Mobile analytics:**
   - Monitor bounce rate on mobile
   - Check time-on-page for article pages
   - Verify mobile engagement metrics

## Troubleshooting

### Issue: Build fails with responsive check errors

**Solution:**
```bash
# Run responsive check separately to see details
npm run check:responsive

# If false positives, adjust thresholds in scripts/check-responsive.mjs
```

### Issue: Horizontal scroll still present on specific article

**Cause:** Article content may have hardcoded wide elements

**Solution:**
1. Inspect element in DevTools
2. Find element causing overflow
3. Add specific CSS rule in `src/styles/global.css`
4. Rebuild and redeploy

### Issue: Desktop layout broken

**Cause:** Mobile CSS affecting desktop

**Solution:**
1. Check media query breakpoints in `src/styles/global.css`
2. Ensure mobile rules are inside `@media (max-width: 640px)`
3. Test at 1024px+ viewport width

### Issue: CVE card not stacking on mobile

**Cause:** CSS specificity or missing mobile rule

**Solution:**
```bash
# Check if mobile CSS is present in built bundle
grep -r "cve-summary-card" dist/assets/*.css
grep -r "grid-template-columns: 1fr" dist/assets/*.css
```

## Success Criteria

✅ Build completes with "Responsive check PASSED"
✅ No horizontal scroll on mobile (360px-640px)
✅ Article titles wrap cleanly
✅ CVE cards stack vertically on mobile
✅ Tables/code blocks scroll within containers
✅ Desktop layout unchanged
✅ No JavaScript errors in console
✅ Nginx reload successful (zero downtime)

## Timeline

- **Preparation:** 5 minutes (review changes)
- **Upload:** 1 minute (git push)
- **Build:** 10 seconds (npm run build)
- **Deploy:** 1 second (nginx reload)
- **Verification:** 5 minutes (manual testing)
- **Total:** ~12 minutes

## Support

If issues arise:
1. Check RESPONSIVE_FIX_SUMMARY.md for technical details
2. Review build output for specific errors
3. Test locally with `npm run preview`
4. Rollback if critical issues found

---

**Deployment Status:** READY ✅
**Risk Level:** LOW
**Downtime:** ZERO
**Rollback Time:** <2 minutes
