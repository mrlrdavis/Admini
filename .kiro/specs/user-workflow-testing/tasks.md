# Tasks: User Workflow Testing & Iterations

## Task 1: Validate Auth Flow
- [x] Verify .env.local has correct Supabase credentials
- [x] Verify signInWithOAuth sends correct redirectTo URL
- [ ] Test email/password sign-up end-to-end
- [ ] Test Google OAuth (needs Supabase redirect URL config)
- [ ] Test sign-out returns to auth screen
- [ ] Test Delete Account returns to auth screen

## Task 2: Validate Onboarding Wizard
- [x] Remove pre-selected defaults from role/focus
- [x] Add hover state to option buttons
- [ ] Verify onboarding completes and shows workspace
- [ ] Verify onboarding state persists across refresh

## Task 3: Validate Workspace Features
- [ ] Test task creation via Supabase (requires auth first)
- [ ] Test task listing
- [ ] Test task status cycling
- [ ] Verify navigation between prototype views

## Task 4: Fix Google OAuth Redirect
- [ ] Add http://127.0.0.1:5173/desktop/ to Supabase Redirect URLs
- [ ] Add http://127.0.0.1:5174/mobile/ to Supabase Redirect URLs
- [ ] Set Site URL in Supabase to http://127.0.0.1:5173/desktop/
- [ ] Test OAuth flow end-to-end

## Task 5: Validate Integrations UX
- [x] Integration cards show for all systems (no empty state)
- [x] Toggle opens connection modal with exit option
- [x] No "first time setup" references

## Task 6: Validate Help Content
- [x] All help topics render content
- [x] Board customization help shows instructions
- [ ] Verify no help topics navigate away without showing content

## Task 7: Mobile Parity Check
- [x] Mobile CSS button widths fixed
- [x] Mobile help content added
- [ ] Mobile sign-out flow works
- [ ] Mobile onboarding defaults cleared

## Task 8: Production Readiness
- [ ] All TypeScript passes (verified)
- [ ] No JS syntax errors in prototypes (verified)
- [ ] Netlify build works (npm run build:apps)
- [ ] OAuth works with production URLs