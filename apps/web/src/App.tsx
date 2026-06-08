import { integrationCatalog } from '@admini/integrations';
import { clearAdminiBrowserState, createIndexedDbStorage } from '@admini/shared';
import { useEffect, useState } from 'react';
import {
  supabase,
  getCurrentUser,
  signOut,
  deleteAccount,
  getOrCreateProfile,
  checkOnboardingComplete,
  markOnboardingComplete,
  updateProfile,
  updateMembershipRole,
  persistOnboardingPreferences,
  acceptInvitation,
  type AuthUser
} from './supabase';
import { AuthScreen } from './AuthScreen';
import { UnifiedWorkspace } from './UnifiedWorkspace';
import { InstallButton } from '@admini/pwa';
import { IntegrationCatalog, organizationService } from '@admini/workspace';

const authStorage = createIndexedDbStorage('auth');

type OnboardingAnswers = {
  role: string;
  focus: string[];
  systems: string[];
  schoolName: string;
  displayName: string;
};

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers | null>(null);
  const [userRole, setUserRole] = useState<string>('admin');
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
      sessionStorage.setItem('admini_invitation_token', token);
      params.delete('invitation_token');
      params.delete('invite');
      const nextSearch = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`);
    } else {
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
          setOnboardingComplete(true);
        } else {
          const serverComplete = await checkOnboardingComplete();
          if (!mounted) return;
          if (serverComplete) {
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

  // Fetch profile from Supabase to obtain role, display name, and organization
  useEffect(() => {
    let mounted = true;
    if (!user) {
      setProfileLoaded(false);
      setUserRole('admin');
      return () => { mounted = false; };
    }
    getOrCreateProfile()
      .then(async (profile: { role: string; organization_id: string; display_name: string }) => {
        if (!mounted) return;
        setUserRole(profile.role);
        setOrganizationId(profile.organization_id);

        if (profile.display_name && profile.display_name !== user?.displayName) {
          setUser((prev) => prev ? { ...prev, displayName: profile.display_name } : prev);
        }

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
          setUserRole('admin');
          setProfileLoaded(true);
        }
      });
    return () => { mounted = false; };
  }, [user?.id]);

  // Listen for auth state changes (token refresh failures, sign-out from another tab)
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
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

    acceptInvitation(invitationToken).then((result: { success: boolean; organizationName?: string; error?: string }) => {
      if (!mounted) return;
      if (result.success) {
        setInvitationToken(null);
        sessionStorage.removeItem('admini_invitation_token');
        if (result.organizationName) {
          setUser((prev) => prev ? { ...prev, schoolName: result.organizationName } : prev);
        }
      } else {
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
    await markOnboardingComplete();
    if (answers.displayName) {
      await updateProfile({ displayName: answers.displayName });
    }
    if (answers.schoolName) {
      await updateProfile({ schoolName: answers.schoolName });
    }
    if (answers.role) {
      await updateMembershipRole(answers.role);
    }
    await persistOnboardingPreferences({ focus: answers.focus, systems: answers.systems });
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
    setUserRole('admin');
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
        <UnifiedWorkspace
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

function LogoLockup() {
  return (
    <div className="logo-lockup" aria-label="Admini">
      <p className="logo-name">AdminI.</p>
    </div>
  );
}

function FirstTimeOnboardingWizard({ userName, schoolName: initialSchoolName = '', onComplete }: { userName: string; schoolName?: string; onComplete: (answers: OnboardingAnswers) => Promise<void>; }) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(userName || '');
  const [role, setRole] = useState('');
  const [focus, setFocus] = useState<string[]>([]);
  const [systems, setSystems] = useState<string[]>([]);
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [applying, setApplying] = useState(false);

  const skipSchoolName = Boolean(initialSchoolName && initialSchoolName.trim());
  const totalSteps = skipSchoolName ? 4 : 5;

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

  function toggleFocus(option: string) {
    setFocus((current) => current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option]);
  }

  function handleBack() {
    setStep((current) => {
      if (current === 0) return 0;
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

  function getTimeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
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
            <h2>What do you want to focus on?</h2>
            <p>Select all that apply. This helps Admini suggest the right defaults and keep the first view clutter-free.</p>
            <div className="option-grid">
              {focusOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={focus.includes(option) ? 'option selected' : 'option'}
                  onClick={() => toggleFocus(option)}
                >
                  {focus.includes(option) && <span className="option-check">&#10003; </span>}
                  {option}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="bubble-submit"
              disabled={focus.length === 0}
              onClick={() => setStep(skipSchoolName ? 4 : 3)}
              style={{ marginTop: '1rem' }}
            >
              Continue
            </button>
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
          {applying ? 'Setting up...' : 'Take me to Admini'}
        </button>
        {step === 4 && <span style={{ fontSize: "13px", color: "rgba(21,18,27,0.56)", fontWeight: 600 }}>Not interested yet?</span>}
      </div>
    </section>
  );
}

