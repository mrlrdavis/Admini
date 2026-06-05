# User Workflow Testing & App Iterations

## Overview
Validate all core user workflows end-to-end across both Desktop and Mobile apps, identify broken paths, and iterate to production-ready state.

## Requirements

### REQ-1: Authentication Flow
- [ ] Email/password sign-up creates account and shows onboarding
- [ ] Email/password sign-in returns to workspace
- [ ] Google OAuth redirects and returns to app
- [ ] Azure/Microsoft OAuth redirects and returns to app
- [ ] LinkedIn OAuth redirects and returns to app
- [ ] Sign out from workspace returns to auth front door
- [ ] Delete Account clears data and returns to auth front door
- [ ] Password reset sends email and allows re-entry

### REQ-2: Onboarding Wizard
- [ ] Options are NOT pre-selected on load
- [ ] Options highlight on hover
- [ ] Selecting role advances to focus step
- [ ] Selecting focus advances to systems step
- [ ] Systems can be multi-selected
- [ ] "Take me to AdminI" completes onboarding and shows workspace
- [ ] Onboarding data persists (refresh doesn't re-show wizard)

### REQ-3: Dashboard / Workspace
- [ ] User name and school display correctly from onboarding data
- [ ] Task creation works via Supabase
- [ ] Task list loads from Supabase
- [ ] Task status updates (open → in_progress → completed)
- [ ] Navigation between views works (dashboard, capture, tasks, etc.)

### REQ-4: Capture (Desktop)
- [ ] Voice mode UI renders and shows transcription area
- [ ] Tap mode word board renders with categories
- [ ] Tap capture builds sentence from selected words
- [ ] Captures save to task list

### REQ-5: Capture (Mobile)
- [ ] Voice mode mic button renders
- [ ] Tap mode word board renders
- [ ] Quick captures panel works
- [ ] Board edit mode (pencil icon) allows add/remove words

### REQ-6: Observations (Desktop)
- [ ] Upload Roster option available (CSV or manual entry)
- [ ] Grade/Subject/Teacher selection works after roster loaded
- [ ] Observation timer starts and runs
- [ ] Stamped notes with tags appear in timeline
- [ ] End observation shows AI summary

### REQ-7: Integrations
- [ ] Integration cards show "Available" status for all systems
- [ ] Toggle opens connection setup modal (OAuth/API Key/Manual)
- [ ] Cancel button in modal exits without change
- [ ] No references to "first time setup" anywhere

### REQ-8: Settings
- [ ] Profile shows name, school, email, role
- [ ] Edit buttons open edit drawers
- [ ] School name edit shows admin-only notice
- [ ] Sign out works from settings
- [ ] Delete Account prompts confirmation then signs out
- [ ] No "Re-run Onboarding" option exists

### REQ-9: Help & Support
- [ ] All help topics display content (not just navigate away)
- [ ] "Customizing Your Board" shows board editing instructions
- [ ] "Getting Started" explains all major features
- [ ] "Contact Support" shows email info

### REQ-10: Cross-Platform Consistency
- [ ] Mobile auth flow mirrors desktop
- [ ] Mobile onboarding has same steps
- [ ] Mobile workspace shows same data
- [ ] Sign out works on both platforms