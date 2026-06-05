# Design: User Workflow Testing

## Architecture
- Both apps (Desktop + Mobile) are React SPAs with Vite
- Auth + Onboarding handled by React App.tsx layer
- Post-auth workspace is a prototype HTML loaded in an iframe
- Iframe communicates with parent via postMessage
- Supabase handles auth, profiles, organizations, tasks

## Data Flow
`
User → Auth Screen (React) → Supabase Auth
  → Onboarding Wizard (React) → IndexedDB (onboarding state)
  → ProtectedWorkspace (React) → iframe (prototype HTML)
    → postMessage ↔ parent for tasks/signout/reset
    → Supabase direct for task CRUD
`

## Key Integration Points
1. supabase.ts - Auth methods, task CRUD, profile management
2. App.tsx - State machine: loading → auth → onboarding → workspace
3. Prototype HTML - Standalone workspace UI with postMessage bridge
4. styles.css - Onboarding wizard and auth screen styling

## Test Strategy
- Manual testing via dev server URLs
- Verify each flow by walking through the UI
- Check browser console for errors
- Verify Supabase Dashboard shows correct data after operations