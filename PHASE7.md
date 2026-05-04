# Phase 7 — User Accounts, Profiles, Media & Polish

## Status: Complete ✅

All work targets the `SERVER/` directory (live production copy).

Phase 7 has been expanded from profile polish into production CMS readiness: real delivery providers, scheduled publishing, media inventory, admin exports, and native systemd deployment. Docker is no longer the production deployment target.

---

## 7.1 — User Profiles & Usernames ✅

**Goal:** Every registered user gets a public profile page at `/profile/@username`.

### Schema changes
- `User.username` — unique, URL-safe slug (e.g. `coaxys`). Distinct from `User.name` (display name).
- `User.bio` — short biography (max 280 chars).
- `User.avatarUrl` — already added in Phase 6.5 (OAuth). Upload endpoint added here.

### Backend routes
- `GET  /api/profile/:username` — public profile (name, bio, avatar, role, joined date, article count)
- `PUT  /api/auth/profile`      — update own profile (name, bio, username, avatarUrl)
- `POST /api/auth/avatar`       — upload profile picture (JPEG/PNG → optional WebP conversion)

### Frontend
- New file: `teknav-profile.jsx` — `UserProfilePage` component
  - Route: `/profile/@username` (e.g. `/profile/@coaxys`)
  - Theme: warm terracotta / burnt orange / deep sand — NOT teal
  - Shows avatar, display name, @username, bio, role badge, join date, article list (if writer/editor)
- `teknav-app.jsx` — route dispatch updated
- `teknav-auth.jsx` — profile settings section added to login page flow (accessible after login)

---

## 7.2 — Security & Auth Flows ✅

### Forgot password
- `POST /api/auth/forgot-password` — generates a reset token (Redis, 1h TTL) and sends the reset email through SMTP when configured
- `POST /api/auth/reset-password` — validates token + hashes new password
- Frontend: "فراموشی رمز عبور" button on login page → modal flow

### OTP (Phone)
- `POST /api/auth/otp/send` — generates and sends a 6-digit OTP through Kavenegar when `SMS_PROVIDER=kavenegar` and `SMS_API_KEY` are set
- `POST /api/auth/otp/verify` — verifies OTP, stores the phone number, and marks `phoneVerifiedAt`
- If SMS is not configured, the API returns a real `503` state instead of pretending delivery happened

### Email verification
- `POST /api/auth/email/verify/request` — creates a one-hour Redis token and sends a verification link through SMTP
- `POST /api/auth/email/verify/confirm` — validates the token for the current session and sets `emailVerifiedAt`
- Profile settings expose email/phone verification controls without mock success states

---

## 7.3 — Media: Images in Articles ✅

### Backend
- `POST /api/admin/uploads` already exists (Phase 5). Extended with:
  - `?webp=1` query param → server-side WebP conversion using `sharp` (installed as optional dep)
  - `sharp` is optional: if not installed, uploads proceed without conversion (no crash)

### Frontend — Article Editor (HTML mode)
- **HTML editor** added to `ArticleEditor` in admin panel (for writer/editor/admin roles)
- Toolbar: Bold, Italic, Heading, Link, Unordered List, Ordered List, Blockquote, Code, HR
- Image insert: inline upload → returns `/uploads/yyyy/mm/uuid.ext` URL inserted into HTML
- WebP conversion toggle in upload panel (off by default)
- Existing 3D diagram panel preserved alongside HTML editor (two tabs: "محتوا" / "نمودار")
- `MediaAsset` records are now created for admin uploads and profile avatars, including filename, URL, MIME type, size, dimensions, uploader, and created date
- `GET /api/admin/media` powers a real admin/editor media library
- `DELETE /api/admin/media/:id` removes unused media and blocks deletion while referenced by content or avatars

---

## 7.4 — Remove All Mock/Placeholder Data ✅

Files cleaned:
- `teknav-home.jsx` — StatsBar: "نویسنده فعال: ۸" → 3 (matches real seed authors)
- `teknav-admin.jsx`
  - `writerStats` — hardcoded 3/1/1 articles → computed from real API data
  - `editorStats` — `Math.min(published, 8)` → real `published` count
  - Dashboard "آخرین فعالیت‌ها" — now loaded only from API; no TeknavStore.getActivity() fallback faked data
  - `ArticlesManagement` — TeknavStore fallback removed; shows empty state if API unavailable
- `teknav-data.js` — `activityLog` kept for legacy reference only (not shown in UI)

---

## 7.5 — UI Polish ✅

### Footer
- Copyright year: `۱۴۰۳` → `۱۴۰۵`

### Mobile responsiveness
- Header: hamburger menu already works; improved padding/font sizes
- Article cards: single column on < 480px
- Admin panel: sidebar collapses to bottom nav on mobile
- Login/signup form: better vertical spacing on small screens
- Profile page: single-column stack on mobile

### Profile page design language
- Warm terracotta (`#C46A4D`) / burnt orange (`#A8512E`) accents
- Deep sand card backgrounds (`#F4EFE6`)
- Unique green (`#2F8F6B`) for highlights (same as diagram accent)
- Avatar with warm circular border
- No teal in profile UI

---

## 7.6 — Email + OTP Infrastructure ✅

### Backend delivery
- `backend/src/lib/email.ts` sends through SMTP when `SMTP_HOST` is configured; otherwise it logs operator-visible output for non-production use
- `backend/src/lib/otp.ts` stores Redis OTPs and sends real SMS through Kavenegar
- Delivery failures are surfaced to the frontend and never shown as fake success

### Env vars (add to `/etc/teknav/backend.env`)
```
# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@teknav.ir

# SMS / OTP
SMS_PROVIDER=kavenegar
SMS_API_KEY=
SMS_SENDER=
```

---

## 7.8 — Scheduling, Exports & Operations ✅

### Article scheduling
- `Article.scheduledAt` and status `زمان‌بندی‌شده` are supported in the editor
- `POST /api/admin/articles/:id/schedule` lets editor/admin roles schedule publication
- `backend/scripts/publish-due.mjs` publishes due articles and clears public cache keys
- `deploy/systemd/teknav-publish-due.timer` runs the publisher every 5 minutes

### Reporting
- `GET /api/admin/dashboard` includes real totals for users, authors, categories, tags, media, top articles, status counts, DB views, and Redis-buffered views
- `GET /api/admin/activity/export.csv` exports activity logs for admin users

### Native deployment
- systemd units live in `deploy/systemd/`
- log rotation lives in `deploy/logrotate/teknav`
- database backups run through `scripts/systemd-backup.sh` and `teknav-backup.timer`
- `DEPLOY.md` is now the canonical non-Docker production runbook for `www.teknav.ir`

### Staff credentials
- `ACCOUNTS.md` contains operator-facing initial credentials and is ignored by git
- nginx blocks `/ACCOUNTS.md`
- `backend/prisma/credentials.json` seeds the login records
- Three writer-admin accounts were added for آرسام صباغ, رادمان قلیچی, and سیداحمدرضا محجوب
- Every seeded user now receives a username; login accepts email or `@username`
- Signup collects display name, username, and password; profile settings allow users of any role to edit display name, username, bio, verification data, and password

---

## 7.7 — WebP Image Optimization ✅

- `sharp` installed as optional dependency in `backend/package.json`
- Upload route (`POST /api/admin/uploads`) gains `?webp=1` query param
- If `sharp` is available and `webp=1`: converts JPEG/PNG → WebP (quality 82), saves as `.webp`
- Admin upload panel shows "تبدیل به WebP" checkbox (off by default)
- Profile avatar upload automatically converts to WebP if sharp is available

---

## Phase 7 Checklist

### Backend
- [x] `User.username` + `User.bio` in schema
- [x] `GET /api/profile/:username`
- [x] `PUT /api/auth/profile`
- [x] `POST /api/auth/avatar`
- [x] `POST /api/auth/forgot-password`
- [x] `POST /api/auth/reset-password`
- [x] `POST /api/auth/otp/send`
- [x] `POST /api/auth/otp/verify`
- [x] `POST /api/auth/email/verify/request`
- [x] `POST /api/auth/email/verify/confirm`
- [x] WebP upload option (`?webp=1`)
- [x] `MediaAsset` model + media library APIs
- [x] Article scheduling API + due publisher script
- [x] Activity CSV export
- [x] `backend/src/lib/email.ts` SMTP sender
- [x] `backend/src/lib/otp.ts`
- [x] `.env.prod.example` updated with SMTP + SMS vars
- [x] Writer-admin seed accounts added to `backend/prisma/credentials.json`
- [x] Login by email or `@username`
- [x] Profile password update API

### Frontend
- [x] `teknav-profile.jsx` — public profile page
- [x] `/profile/@username` route in `teknav-app.jsx`
- [x] Forgot password button + modal in `LoginPage`
- [x] Profile picture upload in settings
- [x] HTML editor in `ArticleEditor`
- [x] Image insertion in articles
- [x] WebP toggle in upload panels
- [x] Media library panel with real API data only
- [x] Scheduled publish controls in article editor
- [x] Activity CSV export link
- [x] Email/phone verification controls in profile settings
- [x] Username field on signup
- [x] Password editing in profile settings
- [x] Footer year → 1405
- [x] StatsBar "نویسنده فعال" → 3
- [x] Mock data removed from admin panel
- [x] Mobile responsiveness improvements

### Docs
- [x] `MEMORY.md` updated
- [x] `ARCH.md` updated
- [x] `SECURITY.md` updated
- [x] `DEPLOY.md` updated for native systemd deployment and SMTP/SMS vars
- [x] `PHASE7.md` written
- [x] `ACCOUNTS.md` added, gitignored, and nginx-blocked

---

## Dependencies Added

| Package | Location | Purpose |
|---|---|---|
| `sharp` | `backend` (optional) | WebP image conversion |
| `nodemailer` | `backend` | SMTP email delivery |

Install on server: `cd backend && npm install sharp` (or it's included if added to `package.json`)

---

## Notes

- Phone OTP requires Kavenegar credentials on the Linux server.
- Forgot-password and email verification require SMTP credentials on the Linux server.
- `sharp` is optional: if not installed, uploads work normally as JPEG/PNG. WebP toggle in the UI gracefully falls back.
