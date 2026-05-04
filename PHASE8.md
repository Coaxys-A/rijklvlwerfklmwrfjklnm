# Phase 8 — Reader Engagement & Real-Time Admin

## Status: Implemented — Linux validation pending

All work targets the `SERVER/` directory. Implementation is in place; run Prisma generation, schema apply, and builds on the Linux production/dev host, not this Windows workstation.

---

## Overview

Phase 8 adds two major capability layers on top of the production-hardened Phase 7 baseline:

1. **Reader engagement** — comments, reading history, in-app notifications, and writer follows. Readers become active participants rather than passive consumers.
2. **Real-time admin** — live visitor counter, live activity feed, live article view counters, and writer push notifications via Server-Sent Events (SSE).

Transport choice: **Server-Sent Events** for all real-time pushes. Every real-time feature in this phase is server→client only, which SSE handles natively through standard HTTP. No WebSocket upgrade headers, no nginx special config, no socket lifecycle management.

---

## 8.1 — Comments

### Goal
Readers can comment on any published article. Comments appear immediately (no moderation queue). Registered users can flag a comment; flagged comments surface in the admin panel for review.

### Schema

```prisma
model Comment {
  id         Int       @id @default(autoincrement())
  article    Article   @relation(fields: [articleId], references: [id], onDelete: Cascade)
  articleId  Int
  author     User      @relation(fields: [authorId], references: [id])
  authorId   Int
  replyTo    Comment?  @relation("Replies", fields: [replyToId], references: [id])
  replyToId  Int?
  replies    Comment[] @relation("Replies")
  body       String    @db.VarChar(1000)
  flagCount  Int       @default(0)
  flagged    Boolean   @default(false)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}

model CommentFlag {
  id        Int      @id @default(autoincrement())
  comment   Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  commentId Int
  user      User     @relation(fields: [userId], references: [id])
  userId    Int
  createdAt DateTime @default(now())

  @@unique([commentId, userId])
}
```

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/articles/:slug/comments` | public | List comments for article (paginated, newest first) |
| `POST` | `/api/articles/:slug/comments` | session | Post a comment (body max 1000 chars) |
| `POST` | `/api/comments/:id/flag` | session | Flag a comment (idempotent per user) |
| `GET` | `/api/admin/comments` | editor+ | List all comments; filter `?flagged=true` |
| `DELETE` | `/api/admin/comments/:id` | editor+ | Delete a comment |
| `PUT` | `/api/admin/comments/:id/unflag` | editor+ | Clear flag on a comment |

### Business Rules
- Only authenticated users can comment or flag.
- A user may not flag the same comment twice (`CommentFlag` unique index).
- When `flagCount >= 5`, `flagged` is set to `true` automatically. Flagged comments remain visible but are highlighted in the admin panel.
- Editor and admin roles can delete any comment; writers can delete their own article's comments.
- Comment body is stripped of HTML on the backend before storage.
- Posting a comment triggers a `comment` notification to the article's author (see 8.3).
- Posting a reply (`replyToId` set) triggers a `comment_reply` notification to the parent comment's author.

### Frontend

- `ArticleCommentSection` component added to the article detail page (below article body).
- Shows comment count in the article header.
- Comments load with `GET /api/articles/:slug/comments`.
- Logged-in users see a textarea + submit button; guests see "برای نظر دادن وارد شوید".
- Each comment shows avatar, display name, `@username`, relative time, body, and a flag icon.
- Admin/editor viewing an article sees a "حذف" button on each comment.

---

## 8.2 — Reading History

### Goal
Every article a logged-in user opens is recorded. Users can review and clear their history from their profile.

### Schema

```prisma
model ReadHistory {
  id        Int      @id @default(autoincrement())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    Int
  article   Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  articleId Int
  readAt    DateTime @default(now())

  @@unique([userId, articleId])
}
```

`@@unique([userId, articleId])` means a record is upserted on each visit — `readAt` is updated to the most recent visit, keeping the list non-duplicated.

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/history` | session | Upsert a read record (body: `{ articleId }`) |
| `GET` | `/api/auth/history` | session | Paginated reading history (newest first) |
| `DELETE` | `/api/auth/history` | session | Clear all reading history for current user |

### Frontend

- Article detail page calls `POST /api/auth/history` after the article body renders (fire-and-forget, no blocking).
- Own profile gains a "تاریخچه خواندن" section listing articles with title, category, and `readAt` date.
- A "پاک کردن تاریخچه" button with a confirmation dialog calls `DELETE /api/auth/history`.
- History tab is only visible on the user's own profile (not public).

---

## 8.3 — In-App Notifications

### Goal
Users receive real-time notifications for: a writer they follow publishing a new article, someone replying to their comment, and (for writers) a new comment on their article. Notifications are stored in Postgres and delivered live via SSE.

### Schema

```prisma
enum NotificationType {
  comment        // someone commented on your article
  comment_reply  // someone replied to your comment
  new_article    // a writer you follow published
}

model Notification {
  id        Int              @id @default(autoincrement())
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    Int
  type      NotificationType
  payload   Json             // { articleSlug, articleTitle, actorName, actorUsername, commentId? }
  read      Boolean          @default(false)
  createdAt DateTime         @default(now())
}
```

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/notifications` | session | List notifications (paginated, unread first) |
| `POST` | `/api/auth/notifications/read-all` | session | Mark all as read |
| `PATCH` | `/api/auth/notifications/:id/read` | session | Mark one as read |
| `DELETE` | `/api/auth/notifications/:id` | session | Delete a notification |
| `GET` | `/api/auth/notifications/stream` | session | SSE stream — delivers `notification` events in real time |

### SSE Notification Stream

`GET /api/auth/notifications/stream` keeps a persistent HTTP connection open. The server pushes an event whenever a new `Notification` row is inserted for that user. The client reconnects automatically on disconnect (native `EventSource` behavior).

Event format:
```
event: notification
data: {"id":42,"type":"comment","payload":{...},"createdAt":"..."}
```

Redis pub/sub is used internally to broadcast notification events from the route handler that creates them to the SSE connection handler holding the open stream. This allows multiple Fastify worker processes to deliver notifications correctly.

### Frontend

- Notification bell icon in the header (visible when logged in) with an unread count badge.
- Clicking the bell opens a dropdown listing recent notifications (last 20).
- Each notification links to the relevant article.
- Unread notifications are visually distinct (bold, accent dot).
- `EventSource` opens `/api/auth/notifications/stream`; on `notification` event, the bell badge increments and the dropdown list prepends the new item.
- "علامت‌گذاری همه به عنوان خوانده‌شده" button calls `POST /api/auth/notifications/read-all`.

---

## 8.4 — Follow Writers

### Goal
Readers can follow any writer. When a followed writer publishes an article, followers receive a `new_article` notification.

### Schema

```prisma
model WriterFollow {
  id         Int      @id @default(autoincrement())
  follower   User     @relation("Follower", fields: [followerId], references: [id], onDelete: Cascade)
  followerId Int
  writer     User     @relation("Writer", fields: [writerId], references: [id], onDelete: Cascade)
  writerId   Int
  createdAt  DateTime @default(now())

  @@unique([followerId, writerId])
}
```

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/writers/:username/follow` | session | Follow a writer |
| `DELETE` | `/api/writers/:username/follow` | session | Unfollow a writer |
| `GET` | `/api/writers/:username/followers` | public | Follower count + list (paginated) |
| `GET` | `/api/auth/following` | session | Writers the current user follows |

### Business Rules
- A user may not follow themselves.
- Only users with role `writer`, `editor`, or `admin` can be followed (role check on the target user).
- When an article is published (`status → published`), the publish route queries all followers of the article's author and inserts `Notification` rows of type `new_article` for each, then publishes a Redis event to wake active SSE streams.

### Frontend

- Writer profile page (`/profile/@username`) shows follower count and a "دنبال کردن" / "دنبال می‌کنی" toggle button (visible when logged in and viewing another user).
- Own profile shows a "نویسندگان دنبال‌شده" section with the list from `GET /api/auth/following`.

---

## 8.5 — Real-Time Admin (SSE)

### Goal
The admin dashboard shows live data: current visitor count (D1), a live activity feed of key events (D2), live article view counts (D4), and writers receive push alerts when their article is commented on or published (D3 — reuses the notification stream from 8.3).

### SSE Admin Stream

`GET /api/admin/stream` — requires `editor` or `admin` role. Single endpoint multiplexes all admin real-time events.

Event types:

| Event | Payload | Trigger |
|---|---|---|
| `visitor_update` | `{ count: number }` | Visitor counter changes (see below) |
| `activity` | `{ type, actor, target, ts }` | Article published, user signed up, comment posted, reaction added |
| `view_update` | `{ articleId, slug, views: number }` | Redis view buffer flushed for an article |

### Visitor Counting (D1)

- When any client hits the public API (`/api/*`), a Redis key `visitors:active` is updated with a TTL-based sliding window (e.g., 5-minute window using a sorted set of `ip:timestamp` entries).
- A background tick (every 10 seconds) reads the sorted set, prunes expired entries, and publishes a `visitor_update` event to Redis pub/sub.
- The admin SSE handler subscribes and fans out to all open admin streams.

### Live Activity Feed (D2)

Events are published to Redis pub/sub by the routes that perform the actions:
- Article publish route → `activity { type: "publish", actor: username, target: articleSlug }`
- Signup route → `activity { type: "signup", actor: username }`
- Comment POST route → `activity { type: "comment", actor: username, target: articleSlug }`
- Reaction POST route → `activity { type: "reaction", actor: username, target: articleSlug }`

The admin SSE stream delivers these to the dashboard as they happen.

### Live View Counter (D4)

The existing Redis view buffer (Phase 4) already batches view counts. Phase 8 extends `publish-due.mjs` (or a new `flush-views.mjs` script) to publish a `view_update` event to Redis pub/sub after each flush. The admin SSE stream delivers this to the dashboard.

### Writer Notifications (D3)

Writers receive real-time alerts through the existing `GET /api/auth/notifications/stream` (8.3). No separate stream is needed. The admin SSE stream (admin role) additionally surfaces comment events in the live feed.

### Frontend — Admin Dashboard

- Live visitor counter widget in the dashboard header: `"بازدیدکنندگان فعال: ۱۲"` — updates in real time.
- Activity feed panel: a vertical list of the last 50 events, prepended live as `activity` events arrive. Each entry shows actor, action type, target, and timestamp.
- Article view counters in the articles table update in place when a `view_update` event arrives for that article.
- Admin SSE connection opens on dashboard mount, closes on unmount. A reconnect indicator shows if the stream drops.

---

## 8.6 — Admin Comment Moderation Panel

### Goal
Editors and admins can review flagged comments, delete abusive ones, and clear flags on legitimate ones — all from a dedicated panel.

### Frontend

- New "نظرات" tab in the admin sidebar.
- Default view: all comments (newest first), paginated.
- Toggle: "فقط گزارش‌شده" — filters to `flagged = true`.
- Each row: article title, commenter name, comment body (truncated), flag count, timestamp, actions (Delete / Clear Flag).
- Bulk delete support for flagged comments.

---

## Dependencies to Add

| Package | Location | Purpose |
|---|---|---|
| None new | — | SSE uses native Node/Fastify `reply.raw`; Redis pub/sub uses existing `ioredis` client |

No new npm dependencies are required. SSE is implemented with `reply.raw` (Node `http.ServerResponse`). Redis pub/sub uses the existing `ioredis` client with a second dedicated subscriber connection (pub/sub connections cannot be reused for other commands).

---

## Schema Migration Summary

New models to add to `backend/prisma/schema.prisma`:
- `Comment`
- `CommentFlag`
- `ReadHistory`
- `Notification` (with `NotificationType` enum)
- `WriterFollow`

Relations to add to existing `User` and `Article` models:
- `User.comments`, `User.commentFlags`, `User.readHistory`, `User.notifications`, `User.following`, `User.followers`
- `Article.comments`, `Article.readHistory`

After schema changes: `npm run prisma:generate` → backend build/type-check → `npm run prisma:apply`.

---

## Phase 8 Checklist

### Backend
- [x] Add `Comment`, `CommentFlag`, `ReadHistory`, `Notification`, `WriterFollow` to schema
- [x] Add relations to `User` and `Article`
- [ ] Run `prisma:generate` + `prisma:apply` on Linux
- [x] `GET/POST /api/articles/:slug/comments`
- [x] `POST /api/comments/:id/flag`
- [x] `GET/DELETE/PUT /api/admin/comments`
- [x] `POST/GET/DELETE /api/auth/history`
- [x] `GET/POST/PATCH/DELETE /api/auth/notifications`
- [x] `GET /api/auth/notifications/stream` (SSE)
- [x] `POST/DELETE /api/writers/:username/follow`
- [x] `GET /api/writers/:username/followers`
- [x] `GET /api/auth/following`
- [x] `GET /api/admin/stream` (SSE — visitor, activity, view_update events)
- [x] Redis pub/sub subscriber connection for SSE fanout
- [x] Visitor counting via Redis sorted set + background tick
- [x] Activity event publishing from publish, signup, comment, and reaction routes
- [x] View update publishing after Redis view buffer flush
- [x] Notification insert + Redis event on comment post
- [x] Notification insert + Redis event on comment reply
- [x] Notification insert + Redis event on article publish (fan-out to followers)

### Frontend
- [x] `ArticleCommentSection` component on article detail page
- [x] Comment count in article header
- [x] Guest prompt to log in for commenting
- [x] Comment flag button
- [x] Notification bell in header with unread badge
- [x] Notification dropdown (last 20, mark all read)
- [x] `EventSource` connection to `/api/auth/notifications/stream`
- [x] "دنبال کردن" toggle on writer profile page
- [x] "نویسندگان دنبال‌شده" section on own profile
- [x] "تاریخچه خواندن" section on own profile
- [x] Fire-and-forget `POST /api/auth/history` on article open
- [x] Admin dashboard: live visitor counter widget
- [x] Admin dashboard: live activity feed panel
- [x] Admin dashboard: in-place view count updates on `view_update` event
- [x] `EventSource` connection to `/api/admin/stream` (admin/editor only)
- [x] Admin "نظرات" sidebar tab with flagged filter, delete/clear-flag actions, and bulk delete all flagged

### Docs
- [x] Update `MEMORY.md`
- [x] Update `ARCH.md`
- [x] Update `SECURITY.md` (comment flagging, SSE auth)
- [x] Update `DEPLOY.md` for SSE nginx handling and Prisma generate order
- [x] Mark `PHASE8.md` implemented
