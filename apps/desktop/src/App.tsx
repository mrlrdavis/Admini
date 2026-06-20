import { integrationCatalog } from '@admini/integrations';
import { clearAdminiBrowserState, createIndexedDbStorage } from '@admini/shared';
import { useEffect, useState, type FormEvent } from 'react';
import {
  supabase,
  getCurrentUser,
  isSupabaseConfigured,
  signInWithOAuthProvider,
  signInWithPassword,
  sendPasswordReset,
  signOut,
  deleteAccount,
  signUpWithPassword,
  getOrCreateProfile,
  checkOnboardingComplete,
  markOnboardingComplete,
  updateProfile,
  updateMembershipRole,
  persistOnboardingPreferences,
  acceptInvitation,
  type AuthUser
} from './supabase';
import { DesktopWorkspace } from './Workspace';
import { InstallButton } from '@admini/pwa';
import { IntegrationCatalog, organizationService } from '@admini/workspace';

type AuthView = 'home' | 'sign-in' | 'sign-up';
type VisualMode = 'day' | 'night';

const authStorage = createIndexedDbStorage('auth');

type OnboardingAnswers = {
  role: string;
  focus: string;
  systems: string[];
  schoolName: string;
  displayName: string;
};


let hoverAudioContext: AudioContext | null = null;
const defaultReturningUserTagline = "we'll take it from here";
const returningUserTaglines = [
  defaultReturningUserTagline,
  'put down those sticky notes',
  'need another coffee?',
  'clear the desk, keep the day'
];

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers | null>(null);
  const [userRole, setUserRole] = useState<string>('staff');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | undefined>(undefined);

  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Parse invitation token from URL on app load so it persists through auth flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invitation_token') ?? params.get('invite');
    if (token) {
      setInvitationToken(token);
      // Store in sessionStorage so the token survives OAuth redirects
      sessionStorage.setItem('admini_invitation_token', token);
      // Clean the token from the URL to avoid leaking it in browser history
      params.delete('invitation_token');
      params.delete('invite');
      const nextSearch = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`);
    } else {
      // Check sessionStorage in case we returned from an OAuth redirect
      const stored = sessionStorage.getItem('admini_invitation_token');
      if (stored) {
        setInvitationToken(stored);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const shouldReset = params.get('reset') === '1' || params.get('resetUserData') === '1';
    const resetState = shouldReset
      ? clearAdminiBrowserState().then(() => {
          params.delete('reset');
          params.delete('resetUserData');
          const nextSearch = params.toString();
          window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`);
        })
      : Promise.resolve();

    resetState
      .then(() => getCurrentUser())
      .then((currentUser) => {
        if (mounted) setUser(currentUser);
      })
      .finally(() => {
        if (mounted) setLoadingUser(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setOnboardingComplete(null);
      setOnboardingAnswers(null);
      return () => {
        mounted = false;
      };
    }

    const completeKey = `onboarding_complete_${user.id}`;
    const answersKey = `onboarding_answers_${user.id}`;

    authStorage.getItem(completeKey)
      .then(async (value) => {
        if (!mounted) return;
        if (value === 'true') {
          // IndexedDB cache says complete - trust it
          setOnboardingComplete(true);
        } else {
          // IndexedDB does not have the flag - check server (handles Google OAuth
          // users whose profile was auto-created by handle_new_user trigger, and
          // users on new devices or after clearing browser data)
          const serverComplete = await checkOnboardingComplete();
          if (!mounted) return;
          if (serverComplete) {
            // Server says complete - update local cache
            await authStorage.setItem(completeKey, 'true');
          }
          setOnboardingComplete(serverComplete);
        }
      })
      .catch(() => {
        if (mounted) setOnboardingComplete(false);
      });

    authStorage.getItem(answersKey)
      .then((value) => {
        if (!mounted) return;
        if (value) {
          try {
            setOnboardingAnswers(JSON.parse(value) as OnboardingAnswers);
          } catch {
            setOnboardingAnswers(null);
          }
        } else {
          setOnboardingAnswers(null);
        }
      })
      .catch(() => {
        if (mounted) setOnboardingAnswers(null);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  // Fetch profile from Supabase profiles table to obtain role, display name,
  // and organization/school name - ensures fields are pre-filled with server data
  // (not just auth metadata which may be stale across devices). REQ-5, REQ-11
  useEffect(() => {
    let mounted = true;
    if (!user) {
      setProfileLoaded(false);
      setUserRole('staff');
      return () => { mounted = false; };
    }
    getOrCreateProfile()
      .then(async (profile) => {
        if (!mounted) return;
        setUserRole(profile.role);
        setOrganizationId(profile.organization_id);

        // Update display name from the profiles table (server source of truth)
        if (profile.display_name && profile.display_name !== user?.displayName) {
          setUser((prev) => prev ? { ...prev, displayName: profile.display_name } : prev);
        }

        // Fetch organization name (school name) from the organizations table
        if (profile.organization_id) {
          try {
            const orgDetails = await organizationService.getOrgDetails(profile.organization_id);
            if (mounted && orgDetails?.name && orgDetails.name !== user?.schoolName) {
              setUser((prev) => prev ? { ...prev, schoolName: orgDetails.name } : prev);
            }
          } catch {
            // Non-critical: fall back to auth metadata for school name
          }
        }

        setProfileLoaded(true);
      })
      .catch(() => {
        if (mounted) {
          setUserRole('staff');
          setProfileLoaded(true);
        }
      });
    return () => { mounted = false; };
  }, [user?.id]);

  // Listen for auth state changes from Supabase (handles token refresh failures,
  // sign-out from another tab, or session expiry during active use).
  // When a SIGNED_OUT event fires, redirect to sign-in gracefully.
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // SIGNED_OUT fires when: sign-out is called, token refresh fails,
        // or the session is invalidated server-side.
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Re-validate session when the page regains visibility (multi-device consistency)
  useEffect(() => {
    if (!user) return;

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (!supabase) return;

      supabase.auth.getSession().then(({ data, error }) => {
        if (error || !data.session) {
          // Session is invalid or expired - redirect to sign-in
          setUser(null);
        }
      });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Accept pending invitation after user is authenticated
  useEffect(() => {
    if (!user || !invitationToken) return;
    let mounted = true;

    acceptInvitation(invitationToken).then(async (result) => {
      if (!mounted) return;
      if (result.success) {
        // Clear the invitation token from state and sessionStorage
        setInvitationToken(null);
        sessionStorage.removeItem('admini_invitation_token');
        // Update school name in local state if the invitation provided one
        if (result.organizationName) {
          setUser((prev) => prev ? { ...prev, schoolName: result.organizationName } : prev);
        }
      } else {
        // Show user-friendly error and clear the token to prevent retry loops
        setInvitationError(result.error ?? 'This invitation link is no longer valid. Please ask your administrator to send a new one.');
        setInvitationToken(null);
        sessionStorage.removeItem('admini_invitation_token');
      }
    });

    return () => { mounted = false; };
  }, [user, invitationToken]);

  async function completeOnboarding(answers: OnboardingAnswers) {
    if (!user) return;
    const completeKey = `onboarding_complete_${user.id}`;
    const answersKey = `onboarding_answers_${user.id}`;
    await authStorage.setItem(completeKey, 'true');
    await authStorage.setItem(answersKey, JSON.stringify(answers));
    // Persist onboarding completion to server (auth metadata) so it survives
    // device changes and browser data clears
    await markOnboardingComplete();
    // Update display name from wizard
    if (answers.displayName) {
      await updateProfile({ displayName: answers.displayName });
    }
    // Update the organization name from the wizard's school name
    if (answers.schoolName) {
      await updateProfile({ schoolName: answers.schoolName });
    }
    // Update the user's role in organization_memberships from wizard selection
    if (answers.role) {
      await updateMembershipRole(answers.role);
    }
    // Persist focus and systems preferences to server (auth metadata)
    await persistOnboardingPreferences({ focus: answers.focus, systems: answers.systems });
    // Update the local user state with the chosen display name
    if (answers.displayName) {
      setUser((prev) => prev ? { ...prev, displayName: answers.displayName } : prev);
    }
    setOnboardingAnswers(answers);
    setOnboardingComplete(true);
  }

  async function resetUserData() {
    await clearAdminiBrowserState();
    await signOut().catch(() => undefined);
    setShowIntegrations(false);
    setOnboardingComplete(null);
    setOnboardingAnswers(null);
    setProfileLoaded(false);
    setUserRole('staff');
    setOrganizationId(undefined);
    setUser(null);
  }

  if (loadingUser) return <div className="auth-page auth-page-home"><LogoLockup /><p>Checking session...</p></div>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  if (onboardingComplete === null) return <div className="auth-page auth-page-home"><LogoLockup /><p>Preparing your workspace...</p></div>;

  const userName = user.displayName ?? user.email?.split('@')[0] ?? 'Admin';
  const schoolName = user.schoolName ?? '';
  const prototypePath = `${import.meta.env.BASE_URL}prototype/Desktop_index.html`;

  if (!onboardingComplete) {
    return (
      <main className="protected-app onboarding-app">
        <div className="onboarding-modal">
          <FirstTimeOnboardingWizard userName={userName} schoolName={schoolName} onComplete={completeOnboarding} />
        </div>
      </main>
    );
  }

  if (!profileLoaded) return <div className="auth-page auth-page-home"><LogoLockup /><p>Loading workspace...</p></div>;

  return (
    <main className="protected-app">
      {invitationError && (
        <div className="invitation-error-banner" role="alert">
          <span className="invitation-error-message">{invitationError}</span>
          <button
            className="invitation-error-dismiss"
            onClick={() => setInvitationError(null)}
            aria-label="Dismiss invitation error"
          >
            &times;
          </button>
        </div>
      )}
      {showIntegrations ? <IntegrationCatalog /> : (
        <DesktopWorkspace
          user={user}
          userRole={userRole}
          organizationId={organizationId}
          userName={userName}
          schoolName={schoolName}
          prototypePath={prototypePath}
          onSignOut={() => {
            signOut().finally(() => setUser(null));
          }}
          onDeleteAccount={async () => {
            await deleteAccount();
            await clearAdminiBrowserState();
            setUser(null);
          }}
          onResetUserData={resetUserData}
          onProfileUpdated={(payload) => {
            setUser((prev) => {
              if (!prev) return prev;
              if (payload.field === 'display-name') {
                return { ...prev, displayName: payload.value };
              }
              if (payload.field === 'school') {
                return { ...prev, schoolName: payload.value };
              }
              return prev;
            });
          }}
        />
      )}
      <InstallButton />
    </main>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [view, setView] = useState<AuthView>('home');
  const [now, setNow] = useState(() => new Date());
  const [breathing, setBreathing] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [signUpStep, setSignUpStep] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [returningTagline, setReturningTagline] = useState(() => getRandomTagline());
  const timeContext = getTimeContext(now);
  const [visualMode, setVisualMode] = useState<VisualMode>(() => timeContext.phase === 'evening' ? 'night' : 'day');
  const passwordScore = getPasswordScore(password);

  // Inline validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validateEmail(value: string): string {
    if (!value) return 'Please enter a valid email address';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(value)) return 'Please enter a valid email address';
    return '';
  }

  function validatePassword(value: string): string {
    if (!value || value.length < 6) return 'Password must be at least 6 characters';
    return '';
  }

  function validateDisplayName(value: string): string {
    if (!value.trim()) return 'Display name cannot be empty';
    return '';
  }

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!breathing) return undefined;
    const timer = window.setTimeout(() => setBreathing(false), 60000);
    return () => window.clearTimeout(timer);
  }, [breathing]);

  useEffect(() => {
    if (view === 'sign-in') setReturningTagline(getRandomTagline());
  }, [view]);

  async function handleOAuth(provider: 'google') {
    setError('');
    if (!isSupabaseConfigured) {
      setError('Single sign-on is almost ready. Restart Admini so the new connection settings can load.');
      return;
    }
    setOauthLoading(true);
    try {
      await signInWithOAuthProvider(provider);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Single sign-on could not start.');
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');
    setError('');
    const errors: Record<string, string> = {};
    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;
    const passErr = validatePassword(password);
    if (passErr) errors.password = passErr;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    if (!isSupabaseConfigured) {
      setError('Sign in is almost ready. Restart Admini so the new connection settings can load.');
      return;
    }
    setSubmitting(true);
    try {
      onAuthenticated(await signInWithPassword({ email, password }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    setStatus('');
    setError('');
    if (!email) {
      setError('Enter your email first, then I can send a reset link.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Password reset is almost ready. Restart Admini so the new connection settings can load.');
      return;
    }
    try {
      await sendPasswordReset(email);
      setStatus('Check your email for a password reset link.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Password reset could not start.');
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');
    setError('');
    // Step-based inline validation
    if (signUpStep === 0) {
      const err = validateDisplayName(displayName);
      if (err) { setFieldErrors({ displayName: err }); return; }
    } else if (signUpStep === 1) {
      if (!schoolName.trim()) { setFieldErrors({ schoolName: 'School name cannot be empty' }); return; }
    } else if (signUpStep === 2) {
      const err = validateEmail(email);
      if (err) { setFieldErrors({ email: err }); return; }
    } else if (signUpStep === 3) {
      const err = validatePassword(password);
      if (err) { setFieldErrors({ password: err }); return; }
    }
    setFieldErrors({});
    if (signUpStep < 3) {
      setSignUpStep((current) => current + 1);
      playBubbleSound();
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Account creation is almost ready. Restart Admini so the new connection settings can load.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUpWithPassword({ email, password, displayName, schoolName });
      if (result.needsEmailConfirmation) {
        setStatus('You are in. Check your email to confirm the account.');
        setView('sign-in');
      } else if (result.user) {
        onAuthenticated(result.user);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Account creation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={`auth-page auth-page-${view} time-${timeContext.phase} visual-${visualMode}`}>
      <button className="breath-button" type="button" onClick={() => setBreathing(true)} onPointerEnter={playBubbleSound}>Breathe</button>
      <button
        className="visual-mode-button"
        type="button"
        aria-label={`Switch to ${visualMode === 'day' ? 'night' : 'day'} mode`}
        onClick={() => setVisualMode((current) => current === 'day' ? 'night' : 'day')}
        onPointerEnter={playBubbleSound}
      >
        <span className="mode-sun" aria-hidden="true" />
        <span className="mode-moon" aria-hidden="true" />
      </button>
      <ProductCredit />
      {breathing ? <BreathingOverlay onClose={() => setBreathing(false)} /> : null}

      {view === 'home' ? (
        <section className="home-panel" aria-label="Admini welcome">
          <p className="time-greeting">{timeContext.greeting}</p>
          <LogoLockup />
          <p className="primary-tagline">cognitive load support for school administrators</p>
          <div className="bubble-actions">
            <button type="button" onClick={() => setView('sign-in')} onPointerEnter={playBubbleSound}>Sign in</button>
            <button type="button" onClick={() => setView('sign-up')} onPointerEnter={playBubbleSound}>Sign up</button>
          </div>
        </section>
      ) : null}

      {view === 'sign-in' ? (
        <section className="split-auth" aria-label="Sign in">
          <AuthStoryPanel greeting={timeContext.greeting} tagline={returningTagline} onBack={() => setView('home')} />
          <div className="auth-conversation">
            <form className="minimal-form" onSubmit={handleSignIn}>
                <label>Email<input type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }} onBlur={() => { const err = validateEmail(email); if (err) setFieldErrors((prev) => ({ ...prev, email: err })); }} autoComplete="email" /></label>
                {fieldErrors.email && <span className="field-error" role="alert">{fieldErrors.email}</span>}
                <label>Password<input type="password" value={password} onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }} onBlur={() => { const err = validatePassword(password); if (err) setFieldErrors((prev) => ({ ...prev, password: err })); }} autoComplete="current-password" /></label>
                {fieldErrors.password && <span className="field-error" role="alert">{fieldErrors.password}</span>}
                <button className="forgot-link" type="button" onClick={handlePasswordReset}>Forgot your password?</button>
                <button className="bubble-submit" disabled={submitting} type="submit" onPointerEnter={playBubbleSound}>{submitting ? 'Opening...' : 'Open Admini'}</button>
              </form>
              <button type="button" className="google-link" onClick={() => handleOAuth('google')} onPointerEnter={playBubbleSound} disabled={oauthLoading}>{oauthLoading ? 'Connecting...' : 'or sign in with Google'}</button>
            <AuthMessages error={error} status={status} />
          </div>
        </section>
      ) : null}

      {view === 'sign-up' ? (
        <section className="split-auth" aria-label="Sign up">
          <AuthStoryPanel greeting={timeContext.greeting} tagline="cognitive load support for school administrators" compactTagline onBack={() => setView('home')} />
          <form className="auth-conversation" onSubmit={handleSignUp}>
            <p className="mini-kicker">First time here</p>
            <SignUpQuestion
              step={signUpStep}
              displayName={displayName}
              schoolName={schoolName}
              email={email}
              password={password}
              passwordScore={passwordScore}
              onDisplayName={setDisplayName}
              onSchoolName={setSchoolName}
              onEmail={setEmail}
              onPassword={setPassword}
              fieldErrors={fieldErrors}
              clearFieldError={clearFieldError}
            />
            <div className="wizard-actions">
              {signUpStep > 0 ? <button type="button" onClick={() => setSignUpStep((current) => current - 1)} onPointerEnter={playBubbleSound}>Back</button> : null}
              <button className="bubble-submit" disabled={submitting} type="submit" onPointerEnter={playBubbleSound}>
                {submitting ? 'Creating...' : signUpStep === 3 ? 'Create account' : 'Next'}
              </button>
            </div>
            <AuthMessages error={error} status={status} />
          </form>
        </section>
      ) : null}
    </main>
  );
}

function LogoLockup() {
  return (
    <div className="logo-lockup" aria-label="Admini">
      <p className="logo-name">AdminI.</p>
    </div>
  );
}

function ProductCredit() {
  return <p className="product-credit">A Pencils Down product</p>;
}

function AuthStoryPanel({
  greeting,
  tagline,
  compactTagline = false,
  onBack
}: {
  greeting: string;
  tagline: string;
  compactTagline?: boolean;
  onBack: () => void;
}) {
  return (
    <div className="auth-story">
      <button className="back-link" type="button" onClick={onBack} onPointerEnter={playBubbleSound}>Back</button>
      <p className="time-greeting">{greeting}</p>
      <LogoLockup />
      <p className={compactTagline ? 'story-tagline story-tagline-small' : 'story-tagline'}>{tagline}</p>
    </div>
  );
}

function SignUpQuestion({
  step,
  displayName,
  schoolName,
  email,
  password,
  passwordScore,
  onDisplayName,
  onSchoolName,
  onEmail,
  onPassword,
  fieldErrors,
  clearFieldError
}: {
  step: number;
  displayName: string;
  schoolName: string;
  email: string;
  password: string;
  passwordScore: number;
  onDisplayName: (value: string) => void;
  onSchoolName: (value: string) => void;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  fieldErrors: Record<string, string>;
  clearFieldError: (field: string) => void;
}) {
  if (step === 0) {
    return (
      <div className="big-question-wrapper">
        <label className="big-question">What should I call you?<input value={displayName} onChange={(event) => { onDisplayName(event.target.value); clearFieldError('displayName'); }} autoFocus /></label>
        {fieldErrors.displayName && <span className="field-error" role="alert">{fieldErrors.displayName}</span>}
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="big-question-wrapper">
        <label className="big-question">What is your school's name?<input value={schoolName} onChange={(event) => { onSchoolName(event.target.value); clearFieldError('schoolName'); }} /></label>
        {fieldErrors.schoolName && <span className="field-error" role="alert">{fieldErrors.schoolName}</span>}
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="big-question-wrapper">
        <label className="big-question">What email should Admini use?<input type="email" value={email} onChange={(event) => { onEmail(event.target.value); clearFieldError('email'); }} autoComplete="email" /></label>
        {fieldErrors.email && <span className="field-error" role="alert">{fieldErrors.email}</span>}
      </div>
    );
  }
  return (
    <div className="big-question-wrapper">
      <label className="big-question">
        Create a password.
        <input type="password" value={password} onChange={(event) => { onPassword(event.target.value); clearFieldError('password'); }} autoComplete="new-password" />
        <span className="meter-label">Make it a good one</span>
        <span className="password-meter" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => <span className={index < passwordScore ? 'filled' : ''} key={index} />)}
        </span>
      </label>
      {fieldErrors.password && <span className="field-error" role="alert">{fieldErrors.password}</span>}
    </div>
  );
}

function AuthMessages({ error, status }: { error: string; status: string }) {
  return (
    <>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}
      {status ? <div className="auth-status" role="status">{status}</div> : null}
    </>
  );
}

function FirstTimeOnboardingWizard({ userName, schoolName: initialSchoolName = '', onComplete }: { userName: string; schoolName?: string; onComplete: (answers: OnboardingAnswers) => Promise<void>; }) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(userName || '');
  const [role, setRole] = useState('');
  const [focus, setFocus] = useState('');
  const [systems, setSystems] = useState<string[]>([]);
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [applying, setApplying] = useState(false);

  // Skip school name step if already provided (invited users)
  const skipSchoolName = Boolean(initialSchoolName && initialSchoolName.trim());
  const totalSteps = skipSchoolName ? 4 : 5;

  // Compute display step number (accounts for skipped school name step)
  function getDisplayStep(): number {
    if (!skipSchoolName) return step + 1;
    if (step <= 2) return step + 1;
    if (step === 4) return 4;
    return step;
  }

  const roleOptions = [
    'School leader',
    'Operations leader',
    'Instructional coach',
    'Campus support',
    'District staff'
  ];

  const focusOptions = [
    'Walkthrough notes and follow-up',
    'Task and issue management',
    'Compliance checks and walkthrough records',
    'Staff and attendance coordination'
  ];

  const systemOptions = integrationCatalog.map((item) => ({
    provider: item.provider,
    label: item.name,
    description: item.description
  }));

  function toggleSystem(provider: string) {
    setSystems((current) => current.includes(provider)
      ? current.filter((item) => item !== provider)
      : [...current, provider]);
  }

  function chooseRole(option: string) {
    setRole(option);
    setStep(2);
  }

  function chooseFocus(option: string) {
    setFocus(option);
    // Skip school name step if already provided
    setStep(skipSchoolName ? 4 : 3);
  }

  function handleBack() {
    setStep((current) => {
      if (current === 0) return 0;
      // When going back from systems step and school name is skipped, jump to focus
      if (skipSchoolName && current === 4) return 2;
      return current - 1;
    });
  }

  async function handleApply() {
    setApplying(true);
    try {
      await onComplete({ role, focus, systems, schoolName, displayName });
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="onboarding-page">
      <header className="onboarding-header">
        <h1>{getTimeGreeting()}, <span id="user-id">{displayName || userName}</span></h1>
        <p>This guided tour keeps your workspace clean and recommends only the settings and integrations that make sense for your role. You can change everything later.</p>
      </header>

      <div className="onboarding-step">
        <p className="step-counter">Step {getDisplayStep()} of {totalSteps}</p>
        {step === 0 && (
          <div>
            <h2>What should I call you?</h2>
            <p>We grabbed this from your account. Feel free to change it.</p>
            <div className="school-name-input">
              <input
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="bubble-submit"
                disabled={!displayName.trim()}
                onClick={() => setStep(1)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2>Who are you?</h2>
            <p>Pick the role that best matches how you want to use Admini.</p>
            <div className="option-grid">
              {roleOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === role ? 'option selected' : 'option'}
                  onClick={() => chooseRole(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2>What do you want to do first?</h2>
            <p>This helps Admini suggest the right defaults and keep the first view clutter-free.</p>
            <div className="option-grid">
              {focusOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === focus ? 'option selected' : 'option'}
                  onClick={() => chooseFocus(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && !skipSchoolName && (
          <div>
            <h2>What's the name of your school?</h2>
            <p>This helps Admini label your workspace so your team knows where they belong.</p>
            <div className="school-name-input">
              <input
                type="text"
                placeholder="e.g. Riverside Elementary"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="bubble-submit"
                disabled={!schoolName.trim()}
                onClick={() => setStep(4)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2>Which systems do you plan to connect?</h2>
            <p>Choose only the systems you want to sync now. Admini will leave everything else disconnected.</p>
            <div className="system-grid">
              {systemOptions.map((option) => (
                <button
                  key={option.provider}
                  type="button"
                  className={systems.includes(option.provider) ? 'system-card selected' : 'system-card'}
                  onClick={() => toggleSystem(option.provider)}
                >
                  <strong>{option.label}</strong>
                  <p>{option.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="wizard-actions">
        <button
          type="button"
          className="wizard-back-arrow"
          aria-label="Go back"
          disabled={step === 0}
          onClick={handleBack}
        >
          &larr;
        </button>
        <button type="button" className="bubble-submit" disabled={applying} onClick={handleApply}>
          {applying ? 'Applying...' : 'Take me to AdminI'}
        </button>
      </div>
    </section>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function BreathingOverlay({ onClose }: { onClose: () => void }) {
  return (
    <section className="breathing-overlay" aria-live="polite">
      <button className="breathing-overlay__close" type="button" onClick={onClose} aria-label="Close breathing exercise">×</button>
      <div className="breath-orb" />
      <p>inhale</p>
      <span>exhale</span>
    </section>
  );
}

function ProviderIcon({ provider }: { provider: 'google' | 'linkedin' | 'outlook' | 'email' | 'phone' }) {
  if (provider === 'google') {
    return (
      <svg aria-hidden="true" className="provider-icon" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.14H12v4.05h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.44Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.62-2.33l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.4 13.99a6 6 0 0 1 0-3.98V7.42H3.06a10 10 0 0 0 0 9.16l3.34-2.59Z" />
        <path fill="#EA4335" d="M12 5.89c1.47 0 2.78.5 3.82 1.49l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.42l3.34 2.59c.79-2.36 3-4.12 5.6-4.12Z" />
      </svg>
    );
  }
  if (provider === 'linkedin') {
    return (
      <svg aria-hidden="true" className="provider-icon" viewBox="0 0 24 24">
        <path fill="#0A66C2" d="M4.98 3.5a2.48 2.48 0 1 1 0 4.96 2.48 2.48 0 0 1 0-4.96ZM3 9.68h3.95V21H3V9.68Zm6.13 0h3.79v1.55h.05c.53-.99 1.82-2.03 3.74-2.03 4 0 4.74 2.63 4.74 6.06V21h-3.95v-5.09c0-1.21-.02-2.77-1.69-2.77-1.69 0-1.95 1.32-1.95 2.69V21H9.13V9.68Z" />
      </svg>
    );
  }
  if (provider === 'email') {
    return (
      <svg aria-hidden="true" className="provider-icon" viewBox="0 0 24 24">
        <path d="M3.5 6.5h17v11h-17z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m4.5 7.5 7.5 6 7.5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="provider-icon" viewBox="0 0 24 24">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

function getTimeContext(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return { phase: 'morning', greeting: 'Good morning', tagline: "we'll take it from here", signUpTagline: 'put down those sticky notes' };
  if (hour < 18) return { phase: 'afternoon', greeting: 'Good afternoon', tagline: 'need another coffee?', signUpTagline: "we'll take it from here" };
  return { phase: 'evening', greeting: 'Good evening', tagline: "we'll take it from here", signUpTagline: 'put down those sticky notes' };
}

function getRandomTagline() {
  return returningUserTaglines[Math.floor(Math.random() * returningUserTaglines.length)] ?? defaultReturningUserTagline;
}

function getPasswordScore(value: string): number {
  return [
    value.length >= 8,
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value)
  ].filter(Boolean).length;
}

function playBubbleSound() {
  const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return;
  hoverAudioContext ??= new AudioContextConstructor();
  const oscillator = hoverAudioContext.createOscillator();
  const gain = hoverAudioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(420, hoverAudioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(760, hoverAudioContext.currentTime + 0.08);
  gain.gain.setValueAtTime(0.0001, hoverAudioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.05, hoverAudioContext.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, hoverAudioContext.currentTime + 0.12);
  oscillator.connect(gain);
  gain.connect(hoverAudioContext.destination);
  oscillator.start();
  oscillator.stop(hoverAudioContext.currentTime + 0.13);
}

