## What does this PR do?
<!-- 1-3 sentences. What changed and why. Link the issue. -->
Closes #___

## Domain
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
- [ ] Breaking change (describe below)

## Breaking change details
<!-- If checked above, describe what callers need to update -->

## Privacy gate
- [ ] No direct Anthropic API calls — all AI goes through PrivacyLayer.callAI()
- [ ] No localStorage or sessionStorage — IndexedDB only
- [ ] No PII in logs, comments, or test fixtures
- [ ] New IndexedDB keys follow retention: captures 90d | tasks 1yr | observations 3yr

## Codex audit (if AI-generated code)
- [ ] No hallucinated imports or methods
- [ ] All new event listeners have removeEventListener cleanup
- [ ] All timers/intervals stored and cleared on teardown
- [ ] escapeHTML() on all user-generated content before DOM insertion

## How to test
1. 
2. 
3. 

## Screenshots
<!-- Required for any UI change. Drag and drop here. -->