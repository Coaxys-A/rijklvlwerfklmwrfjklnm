# Claude Code File Management System

## Overview

When creating or updating project documentation, maintain three complementary files to optimize token usage and organization.

Teknav-specific status: production is native Linux/systemd for `www.teknav.ir`, backend data is served through Fastify/PostgreSQL/Redis, admin panels are API-only, operator credentials are documented in ignored `ACCOUNTS.md`, and Phase 10 is the active roadmap with SEO growth, trust, retention, and monetization layered on the implemented publication stack.

---

## File Responsibilities

### 1. **CLAUDE.md** (Project Directives & Preferences)

**Purpose:** Your immediate working instructions—what you want Claude to do and how.

**Include:**

- User preferences (tone, style, formatting)
- Project-specific conventions & rules
- Coding standards & patterns you prefer
- Feature flags or current focus areas
- **Minimal memory section** (see below)

**Do NOT include:**

- Detailed project history
- Full technical specifications
- Complete architecture diagrams
- Long lists of implementation details

### 2. **MEMORY.md** (Project Context & Details)

**Purpose:** Single source of truth for all project knowledge—small but important details that inform decisions.

**Include:**

- Project overview & purpose
- Tech stack & key dependencies
- Important decisions & rationale (ADRs)
- Known constraints or limitations
- File structure & organization
- Key API contracts or interfaces
- Third-party integrations
- Environment setup details
- Resolved issues or lessons learned

**Keep concise:** Use bullet points, not prose. Aim for ~500–1500 tokens.

### 3. **ARCH.md** (Plans, Roadmap & Todos)

**Purpose:** Living planning document—current todos, roadmap, and design decisions in progress.

**Include:**

- Current sprint/phase goals
- TODO items (organized by priority or feature)
- In-progress features or refactors
- Design proposals under consideration
- Roadmap & future features
- Blocked items or waiting tasks

**Update frequency:** Before or after major work sessions. Keeps priorities visible.

---

## Minimal Memory in CLAUDE.md

Instead of duplicating context, use a **pointer**:

```markdown
## Memory
See **MEMORY.md** for full project context, tech stack, and key decisions.

Quick reference:
- **Built with:** [Framework/Language]
- **Current phase:** Phase 10
- **Key constraint:** Zero CDN / Persian-first RTL / native Linux deployment
```

---

## Token Flow Strategy

1. At session start: load `CLAUDE.md` (directives) and `ARCH.md` (current work).
2. If unclear: reference `MEMORY.md` for context.
3. When updating:
   - `CLAUDE.md`: only when preferences or directives change.
   - `MEMORY.md`: when learning new critical info.
   - `ARCH.md`: after major work sessions or priority shifts.
   - `DEPLOY.md`: keep complete whenever production paths, env, backups, SSE, or deployment steps change.
   - `AGENTS.md`: record agent-facing rules, important file paths, and operational constraints.
   - `PHASE10.md`: keep the active Phase 10 surface current.
4. Avoid redundancy: never repeat `MEMORY.md` content in `CLAUDE.md` or `ARCH.md`.

---

## Best Practices

- Keep each file focused on its purpose.
- Use `ARCH.md` as the working document.
- Point to `MEMORY.md` when context is needed.
- Batch `MEMORY.md` updates to save tokens.
