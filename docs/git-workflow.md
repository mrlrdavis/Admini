# AdminI — Git Workflow, Commit Conventions & PR Instructions
**Stack:** VS Code · GitHub · Supabase · Cloudflare Pages/Workers · Codex (OpenAI)**  
**Applies to:** Desktop build (`/desktop`), Mobile build (`/mobile`), Privacy Layer (`/shared`), Backend (`/backend`)

---

## 1. Repository Structure Assumptions

```
admini/
├── desktop/
│   ├── Desktop_index.html
│   ├── Desktop_app.js
│   ├── Desktop_base.css
│   └── Desktop_style.css
├── mobile/
│   ├── Mobile_index.html
│   ├── Mobile_app.js
│   ├── Mobile_base.css
│   └── Mobilestyle.css
├── shared/
│   └── admini-privacy-layer.js
├── backend/
│   ├── supabase/
│   │   ├── migrations/
│   │   └── functions/
│   └── workers/        ← Cloudflare Workers
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/
│       ├── ci.yml
│       └── deploy-preview.yml
├── .gitignore
└── README.md
```

> **If your repo is not structured this way yet**, do not reorganize before reading Section 9 (Migration Notes).

---

## 2. Branch Strategy

AdminI uses a **trunk-based development** model with short-lived feature branches. There is no long-lived `develop` branch — `main` is always deployable.

### Protected Branches

| Branch | Purpose | Who can merge |
|--------|---------|---------------|
| `main` | Production — auto-deploys to Cloudflare Pages (prod) | PR only, requires 1 approval |
| `staging` | Pre-production — auto-deploys to Cloudflare Pages (preview) | PR only |

### Working Branches

Always branch off `main` unless you are hotfixing staging.

```
<type>/<scope>-<short-description>
```

**Examples:**

```
feat/mobile-capture-word-board-edit
fix/desktop-drawer-double-mount
chore/supabase-schema-task-retention
feat/shared-pii-tokenization-v2
docs/pr-workflow
hotfix/mobile-tap-mode-selection-bug
```

**Types:**

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `chore` | Tooling, dependencies, config — no production code change |
| `refactor` | Internal restructure with no behavior change |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `hotfix` | Emergency patch to production |
| `spike` | Exploratory / throwaway — never merges to main directly |

### Branch Rules (set these in GitHub → Settings → Branches)

- Require pull request before merging to `main`
- Require at least 1 approving review
- Require status checks to pass (CI workflow)
- Do not allow bypassing the above settings
- Auto-delete head branches after merge

---

## 3. Commit Message Convention

AdminI follows **Conventional Commits** (https://www.conventionalcommits.org). This is not optional — Codex will use these to generate changelogs and release notes automatically.

### Format

```
<type>(<scope>): <imperative summary under 72 chars>

[optional body — wrap at 72 chars, explain WHY not WHAT]

[optional footers]
BREAKING CHANGE: <description>
Refs: #<issue-number>
Reviewed-by: <name>
```

### Scope Values

| Scope | Maps to |
|-------|---------|
| `mobile` | `/mobile` directory |
| `desktop` | `/desktop` directory |
| `shared` | `/shared/admini-privacy-layer.js` |
| `backend` | `/backend/supabase` or `/backend/workers` |
| `ci` | GitHub Actions workflows |
| `infra` | Cloudflare config, wrangler.toml |
| `auth` | Supabase Auth integration |
| `db` | Supabase schema, migrations, RLS policies |
| `privacy` | PII detection, tokenization, FERPA retention logic |

### Good Commit Examples

```
feat(mobile): add swipe carousel to add-task bottom sheet

User can now swipe left on page 1 to reach priority picker,
swipe right to return. Prevents accidental submission before
priority is set. Minimum swipe threshold: 40px horizontal,
filtered against vertical scroll intent.

Refs: #14
```

```
fix(shared): prevent PII tokenization bypass on empty string input

escapeHTML() was returning early on empty string before
validateInput() ran, allowing raw tokens to reach callAI().
Added guard clause before early return.

Refs: #21
```

```
chore(db): add supabase migration for task retention schedule

Codifies FERPA retention: captures 90d, tasks 1yr, observations
3yr. Implements pg_cron job for nightly soft-delete sweep.
Does not delete — marks is_archived = true for admin review.

Refs: #8
```

```
refactor(desktop): extract drawer lifecycle into standalone module

Drawer open/close/ESC logic extracted from app.js into
drawer-manager.js. No behavior change. Prerequisite for
multi-drawer support planned in Q3.
```

```
BREAKING CHANGE: privacy layer API signature updated

PrivacyLayer.callAI() now requires { prompt, context, role }
object instead of positional arguments. All callers in
Desktop_app.js and Mobile_app.js updated in this commit.

Refs: #31
```

### Bad Commit Examples (do not do these)

```
fixed stuff                     ← no type, no scope, no clarity
WIP                             ← never commit WIP to a PR branch
update app.js                   ← describes what, not why
feat: lots of changes           ← too broad, should be split
```

### Codex-Specific: When Using AI-Generated Commits

When Codex generates commit messages for you, **always review and edit** before accepting. Codex defaults to vague summaries like `"Update mobile app"`. Reject any message that:

- Lacks a scope
- Describes what changed rather than why
- Exceeds 72 characters in the summary line
- Does not reference the relevant issue number if one exists

---

## 4. Commit Hygiene Rules

These apply to every branch before opening a PR:

**4.1 — One logical change per commit**  
Do not bundle a bug fix and a new feature in the same commit. If you find yourself writing "and" in the summary, split the commit.

**4.2 — No secrets ever committed**  
Supabase `anon` and `service_role` keys, Cloudflare API tokens, and any `.env` values must never appear in committed code. Use `.env.local` (gitignored) locally and GitHub Actions Secrets for CI.

Set up your `.gitignore` to include:
```
.env
.env.local
.env.*.local
*.pem
*.key
supabase/.branches
supabase/.temp
.wrangler/
```

**4.3 — No commented-out code in final commits**  
Dead code should be deleted, not commented out. If you need to preserve it for reference, link to the commit hash in a code comment instead.

**4.4 — No console.log in production paths**  
The privacy layer and all AI call paths must have zero `console.log` statements in merged code. `console.warn` and `console.error` are permitted for caught exceptions.

**4.5 — Squash vs. merge**  
- Feature branches: **Squash and merge** into `main`. One commit per feature in the main branch history.
- Hotfixes: **Merge commit** (preserves the urgency marker in history).
- Release tags: **Merge commit** from `staging` → `main`.

---

## 5. Pull Request Instructions

### 5.1 — Before Opening a PR

Run this checklist locally:

```bash
# 1. Rebase onto latest main
git fetch origin
git rebase origin/main

# 2. Confirm no secrets in diff
git diff origin/main -- . ':(exclude).env*'

# 3. Lint check (add eslint to your toolchain if not present)
npx eslint desktop/Desktop_app.js mobile/Mobile_app.js shared/admini-privacy-layer.js

# 4. Smoke test both builds in browser
# Open desktop/Desktop_index.html and mobile/Mobile_index.html locally

# 5. Confirm privacy layer not bypassed
# Search for any direct fetch() calls that skip PrivacyLayer.callAI()
grep -rn "fetch.*anthropic" desktop/ mobile/ --include="*.js"
# Result should be empty — all AI calls must go through shared/admini-privacy-layer.js
```

### 5.2 — PR Title Format

PR titles follow the same Conventional Commits format as commit messages:

```
feat(mobile): add editable word board with remove + add word flow
fix(desktop): resolve drawer double-mount on rapid navigation
chore(db): add FERPA-aligned retention migration for captures table
```

### 5.3 — PR Description Template

Copy this into `.github/PULL_REQUEST_TEMPLATE.md` in your repo:

```markdown
## What does this PR do?
<!-- 1-3 sentences. What changed and why. Link the issue. -->
Closes #___

## Domain
<!-- Check all that apply -->
- [ ] Mobile build (`/mobile`)
- [ ] Desktop build (`/desktop`)
- [ ] Privacy layer (`/shared`)
- [ ] Supabase backend (`/backend/supabase`)
- [ ] Cloudflare Workers (`/backend/workers`)
- [ ] CI/infra

## Type of change
- [ ] New feature
- [ ] Bug fix
- [ ] Refactor (no behavior change)
- [ ] Schema migration
- [ ] Dependency / config update
- [ ] Breaking change (describe below)

## Breaking change details
<!-- If checked above, describe what callers need to update -->

## Privacy layer impact
<!-- Check one -->
- [ ] This change touches PII detection, tokenization, or AI call paths → privacy review required before merge
- [ ] This change does not touch the privacy layer or AI call paths

## FERPA checklist
- [ ] No raw student data (names, IDs, grades, behavior records) appears in logs, comments, or test fixtures
- [ ] No new localStorage or sessionStorage usage introduced
- [ ] Any new IndexedDB keys follow the retention schedule (captures: 90d, tasks: 1yr, observations: 3yr)
- [ ] Telemetry, if any, is aggregate-only and contains no PII

## How to test
<!-- Step-by-step. Assume the reviewer has not seen this code before. -->
1. 
2. 
3. 

## Screenshots / recordings
<!-- Required for any UI change. Drag and drop here. -->

## Codex-generated code disclosure
- [ ] This PR contains AI-generated code
- [ ] If yes: I have reviewed every line, confirmed behavior, and removed hallucinated imports or methods
```

### 5.4 — Reviewer Assignment

Until the team grows beyond 2 founders:

- Both founders review every PR that touches the privacy layer or Supabase migrations
- Single-founder review is acceptable for isolated UI changes with no backend or privacy layer impact
- Never self-merge to `main` — swap reviews even if it feels slow

### 5.5 — PR Size Guidelines

| PR Size | Lines changed | Policy |
|---------|--------------|--------|
| Small | < 200 | Merge same day if CI passes |
| Medium | 200–500 | Allow 24h for review |
| Large | 500–1000 | Break it up if possible; flag reason it can't be split |
| Oversized | > 1000 | Reject and restructure — no exceptions |

Codex has a tendency to generate large diffs. Set a personal rule: if Codex output exceeds 500 lines, split it into a `refactor` PR (structure only, no behavior change) followed by a `feat` PR (behavior on top of the new structure).

---

## 6. Codex-Specific Instructions

### 6.1 — Prompt Patterns for AdminI

When using Codex (via VS Code extension or API) to generate code for this project, include this context block in every prompt:

```
Project: AdminI — school administration AI companion app
Stack: Vanilla JS, HTML, CSS (no framework), Supabase (backend/auth), Cloudflare Pages (hosting)
Privacy constraint: ALL AI inference calls must go through PrivacyLayer.callAI() in shared/admini-privacy-layer.js. Never call the Anthropic API directly from Desktop_app.js or Mobile_app.js.
Storage constraint: Use IndexedDB via the persistence layer. Never use localStorage or sessionStorage.
FERPA constraint: No student PII (names, IDs, grades, behavior) in logs, comments, or test data.
Code style: ES6+, strict mode, IIFE module pattern, escapeHTML() on all user-generated content before DOM insertion.
```

### 6.2 — Audit Checklist for Codex Output

Before committing any Codex-generated code, run through this:

```
□ No direct fetch() to Anthropic API (must go through PrivacyLayer)
□ No localStorage or sessionStorage (use IndexedDB)
□ No eval(), innerHTML with unescaped user content, or document.write()
□ No imported npm packages that don't exist in the project (hallucinated imports)
□ No hardcoded API keys, UUIDs, or credentials
□ All new DOM event listeners have corresponding cleanup (removeEventListener)
□ Timer/interval IDs are stored and cleared on component teardown
□ escapeHTML() applied before any user-generated string reaches innerHTML
```

### 6.3 — Codex Commit Workflow in VS Code

```bash
# Stage only what Codex generated for this specific task
git add -p   # interactive patch staging — review every hunk

# Write the commit message yourself (do not accept Codex-generated message)
git commit

# Push to your feature branch
git push origin feat/your-branch-name

# Open PR via GitHub CLI (optional but faster)
gh pr create --title "feat(mobile): your title" --body-file .github/PR_DRAFT.md
```

---

## 7. Supabase Migration Workflow

Schema changes require their own commit and PR — never bundle a migration with application code changes.

### Creating a Migration

```bash
# Generate a new migration file
supabase migration new <descriptive-name>
# Example: supabase migration new task_retention_schedule

# Edit the generated file in supabase/migrations/
# Then test locally
supabase db reset   # resets local Postgres and runs all migrations

# Confirm RLS policies are present on every new table
# No table should exist without row-level security enabled
```

### Migration Commit Pattern

```
chore(db): add task retention schedule migration

Creates pg_cron job for nightly is_archived sweep.
Implements FERPA retention: tasks archived after 365d,
captures after 90d, observations after 1095d.
RLS policy: users can only read their own archived records.

Refs: #8
```

### Migration PR Rules

- Every migration PR must include a **rollback script** as a code comment at the top of the migration file
- Migrations that add or drop columns on tables with > 0 rows in production require a separate `data-migration` PR
- Never run `supabase db push` to production without a passing CI run

---

## 8. Cloudflare Deployment Workflow

### Pages (Static Hosting — Desktop + Mobile builds)

Cloudflare Pages auto-deploys on push to `main` (production) and `staging` (preview). No manual deploy steps required after initial setup.

**Initial setup (one time):**

```bash
# Connect repo in Cloudflare Dashboard → Pages → Create Project
# Build settings:
#   Build command: (none — static files)
#   Build output directory: /   (or /desktop or /mobile depending on split)
#   Root directory: /
```

**Environment variables in Cloudflare Pages** (never in code):

```
SUPABASE_URL=<your-project-url>
SUPABASE_ANON_KEY=<your-anon-key>
```

### Workers (Edge Functions)

```bash
# Deploy a Worker
cd backend/workers
wrangler deploy

# Deploy to staging only
wrangler deploy --env staging
```

Worker changes require their own PR. Do not bundle Worker changes with frontend changes.

### Commit for Cloudflare Config Change

```
chore(infra): add wrangler.toml staging environment config

Separates staging and production Worker environments.
Staging uses SUPABASE_URL_STAGING secret.
Production uses SUPABASE_URL secret.
Both use the same Worker code — environment variable controls routing.
```

---

## 9. GitHub Actions — CI Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: AdminI CI

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main, staging]

jobs:
  lint-and-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npx eslint desktop/ mobile/ shared/ --ext .js

      - name: Check for direct Anthropic API calls (privacy gate)
        run: |
          if grep -rn "fetch.*anthropic\.com" desktop/ mobile/ --include="*.js"; then
            echo "ERROR: Direct Anthropic API call found. All AI calls must go through PrivacyLayer.callAI()"
            exit 1
          fi

      - name: Check for localStorage usage (FERPA gate)
        run: |
          if grep -rn "localStorage\|sessionStorage" desktop/ mobile/ --include="*.js"; then
            echo "ERROR: localStorage/sessionStorage found. Use IndexedDB via the persistence layer."
            exit 1
          fi

      - name: Check for hardcoded secrets
        run: |
          if grep -rn "sk-\|service_role\|eyJ" desktop/ mobile/ shared/ --include="*.js"; then
            echo "ERROR: Possible hardcoded secret detected."
            exit 1
          fi

  supabase-migration-check:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.title, 'db') || contains(github.event.pull_request.title, 'migration')
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Validate migrations
        run: supabase db lint
```

---

## 10. Release Tagging

After merging to `main`, tag releases using semantic versioning:

```bash
# After a feature release
git tag -a v0.3.0 -m "feat: mobile word board edit mode, desktop drawer refactor"
git push origin v0.3.0

# After a hotfix
git tag -a v0.2.1 -m "fix: mobile tap mode selection state on rapid navigation"
git push origin v0.2.1
```

**Version schema for pre-launch:**

- `v0.x.0` — feature releases during development
- `v0.x.y` — bug fixes and patches
- `v1.0.0` — first production release to paying clients

---

## 11. Quick Reference Card

```
NEW FEATURE
  git checkout -b feat/<scope>-<description>
  [build, test, audit with Codex checklist]
  git add -p
  git commit -m "feat(<scope>): <imperative summary>"
  git push origin feat/<scope>-<description>
  gh pr create

BUG FIX
  git checkout -b fix/<scope>-<description>
  [fix, test]
  git commit -m "fix(<scope>): <imperative summary>"
  git push && gh pr create

HOTFIX TO PRODUCTION
  git checkout -b hotfix/<description> origin/main
  [fix]
  git commit -m "fix(<scope>): <imperative summary>"
  gh pr create --base main --title "hotfix: <description>"
  [merge with merge commit, not squash]

SUPABASE MIGRATION
  supabase migration new <name>
  [edit, test locally with supabase db reset]
  git checkout -b chore/db-<migration-name>
  git commit -m "chore(db): <description>"
  gh pr create

BEFORE ANY PR MERGE
  □ Rebase onto origin/main
  □ CI passing
  □ Privacy gate passing (no direct Anthropic calls)
  □ FERPA gate passing (no localStorage)
  □ PR template filled out completely
  □ At least 1 approval
```

---

*Last updated: May 2026 — AdminI v0.x development phase*  
*Maintainer: Update this document when the repo structure changes or new services are added.*
