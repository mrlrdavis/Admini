import { integrationCatalog } from '@admini/integrations';
import { createIndexedDbStorage, nowIso, type IntegrationCatalogItem, type IntegrationProvider } from '@admini/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  getCurrentUser,
  isSupabaseConfigured,
  signInWithOAuthProvider,
  signInWithPassword,
  sendPasswordReset,
  signOut,
  signUpWithPassword,
  type AuthUser
} from './supabase';

type AuthView = 'home' | 'sign-in' | 'sign-up';
type VisualMode = 'day' | 'night';
type IntegrationRecord = {
  provider: IntegrationProvider;
  status: 'available' | 'connecting' | 'connected' | 'error';
  authMode?: string;
  lastSyncAt?: string;
};

const integrationStorage = createIndexedDbStorage('integrations');
let hoverAudioContext: AudioContext | null = null;

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [showIntegrations, setShowIntegrations] = useState(false);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
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

  if (loadingUser) return <div className="auth-page auth-page-home"><LogoLockup /><p>Checking session...</p></div>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;

  return (
    <ProtectedWorkspace
      appName="Admini"
      prototypePath={`${import.meta.env.BASE_URL}prototype/Desktop_index.html`}
      user={user}
      showIntegrations={showIntegrations}
      onToggleIntegrations={() => setShowIntegrations((current) => !current)}
      onSignOut={() => {
        signOut().finally(() => setUser(null));
      }}
    />
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [view, setView] = useState<AuthView>('home');
  const [now, setNow] = useState(() => new Date());
  const [breathing, setBreathing] = useState(false);
  const [emailSignIn, setEmailSignIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [signUpStep, setSignUpStep] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const timeContext = getTimeContext(now);
  const [visualMode, setVisualMode] = useState<VisualMode>(() => timeContext.phase === 'evening' ? 'night' : 'day');
  const passwordScore = getPasswordScore(password);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!breathing) return undefined;
    const timer = window.setTimeout(() => setBreathing(false), 60000);
    return () => window.clearTimeout(timer);
  }, [breathing]);

  async function handleOAuth(provider: 'google' | 'apple' | 'azure') {
    setError('');
    if (!isSupabaseConfigured) {
      setError('Single sign-on is almost ready. Restart Admini so the new connection settings can load.');
      return;
    }
    try {
      await signInWithOAuthProvider(provider);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Single sign-on could not start.');
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');
    setError('');
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
        setEmailSignIn(true);
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
      {breathing ? <BreathingOverlay /> : null}

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
          <AuthStoryPanel greeting={timeContext.greeting} tagline={timeContext.tagline} onBack={() => setView('home')} />
          <div className="auth-conversation">
            <div className="provider-boxes" aria-label="Sign in options">
              <button type="button" aria-label="Sign in with Google" title="Google" onClick={() => handleOAuth('google')} onPointerEnter={playBubbleSound}><ProviderIcon provider="google" /></button>
              <button type="button" aria-label="Sign in with Microsoft" title="Microsoft" onClick={() => handleOAuth('azure')} onPointerEnter={playBubbleSound}><ProviderIcon provider="outlook" /></button>
              <button type="button" aria-label="Sign in with Apple" title="Apple" onClick={() => handleOAuth('apple')} onPointerEnter={playBubbleSound}><ProviderIcon provider="apple" /></button>
              <button type="button" aria-label="Sign in with email" title="Email" onClick={() => setEmailSignIn(true)} onPointerEnter={playBubbleSound}><ProviderIcon provider="email" /></button>
            </div>
            {emailSignIn ? (
              <form className="minimal-form" onSubmit={handleSignIn}>
                <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
                <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
                <button className="forgot-link" type="button" onClick={handlePasswordReset}>Forgot your password?</button>
                <button className="bubble-submit" disabled={submitting} type="submit" onPointerEnter={playBubbleSound}>{submitting ? 'Opening...' : 'Open Admini'}</button>
              </form>
            ) : null}
            <AuthMessages error={error} status={status} />
          </div>
        </section>
      ) : null}

      {view === 'sign-up' ? (
        <section className="split-auth" aria-label="Sign up">
          <AuthStoryPanel greeting={timeContext.greeting} tagline={timeContext.signUpTagline} onBack={() => setView('home')} />
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
      <svg className="admini-logo" aria-hidden="true" viewBox="0 0 120 120" role="img">
        <path className="admini-logo-body" d="M26 96C36 61 43 39 53 21c6-11 20-11 26 0 10 18 17 40 27 75 3 11-10 18-19 11-5-4-8-12-11-21H57c-3 9-6 17-11 21-9 7-23 0-20-11Z" />
        <path className="admini-logo-hole" d="M61 56c1-7 3-13 5-18 2 5 4 11 5 18 1 5-2 8-5 8s-6-3-5-8Z" />
      </svg>
      <p className="logo-name" aria-hidden="true">dminI.</p>
    </div>
  );
}

function ProductCredit() {
  return <p className="product-credit">A Pencils Down product</p>;
}

function AuthStoryPanel({ greeting, tagline, onBack }: { greeting: string; tagline: string; onBack: () => void }) {
  return (
    <div className="auth-story">
      <button className="back-link" type="button" onClick={onBack} onPointerEnter={playBubbleSound}>Back</button>
      <p className="time-greeting">{greeting}</p>
      <LogoLockup />
      <p className="story-tagline">{tagline}</p>
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
  onPassword
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
}) {
  if (step === 0) {
    return <label className="big-question">What should I call you?<input value={displayName} onChange={(event) => onDisplayName(event.target.value)} required autoFocus /></label>;
  }
  if (step === 1) {
    return <label className="big-question">What is your school's name?<input value={schoolName} onChange={(event) => onSchoolName(event.target.value)} required /></label>;
  }
  if (step === 2) {
    return <label className="big-question">What email should Admini use?<input type="email" value={email} onChange={(event) => onEmail(event.target.value)} required autoComplete="email" /></label>;
  }
  return (
    <label className="big-question">
      Create a password.
      <input type="password" minLength={8} value={password} onChange={(event) => onPassword(event.target.value)} required autoComplete="new-password" />
      <span className="meter-label">Make it a good one</span>
      <span className="password-meter" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => <span className={index < passwordScore ? 'filled' : ''} key={index} />)}
      </span>
    </label>
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

function BreathingOverlay() {
  return (
    <section className="breathing-overlay" aria-live="polite">
      <div className="breath-orb" />
      <p>inhale</p>
      <span>exhale</span>
    </section>
  );
}

function ProviderIcon({ provider }: { provider: 'google' | 'apple' | 'outlook' | 'email' }) {
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
  if (provider === 'apple') {
    return (
      <svg aria-hidden="true" className="provider-icon" viewBox="0 0 24 24">
        <path fill="currentColor" d="M16.36 12.65c-.03-2.74 2.24-4.05 2.34-4.12-1.28-1.87-3.26-2.13-3.96-2.16-1.69-.17-3.29.99-4.14.99-.86 0-2.18-.96-3.59-.93-1.85.03-3.55 1.08-4.5 2.73-1.92 3.33-.49 8.27 1.38 10.97.91 1.32 2 2.8 3.43 2.75 1.37-.05 1.89-.89 3.55-.89 1.65 0 2.12.89 3.58.86 1.48-.03 2.42-1.35 3.32-2.68 1.05-1.53 1.48-3.02 1.5-3.1-.03-.01-2.88-1.1-2.91-4.42ZM13.64 4.59c.75-.91 1.26-2.17 1.12-3.43-1.08.04-2.39.72-3.16 1.63-.69.8-1.3 2.09-1.13 3.32 1.2.09 2.43-.61 3.17-1.52Z" />
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

function ProtectedWorkspace({
  appName,
  prototypePath,
  user,
  showIntegrations,
  onToggleIntegrations,
  onSignOut
}: {
  appName: string;
  prototypePath: string;
  user: AuthUser;
  showIntegrations: boolean;
  onToggleIntegrations: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="protected-app">
      <header className="session-bar">
        <strong>{appName}</strong>
        <div>
          <span>{user.email}</span>
          <button type="button" onClick={onToggleIntegrations}>{showIntegrations ? 'Workspace' : 'Add integrations'}</button>
          <button type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      {showIntegrations ? <IntegrationsPanel /> : <iframe className="prototype-frame" src={prototypePath} title={`${appName} workspace`} />}
    </main>
  );
}

function IntegrationsPanel() {
  const [records, setRecords] = useState<Record<string, IntegrationRecord>>({});
  const connectedCount = useMemo(() => Object.values(records).filter((record) => record.status === 'connected').length, [records]);

  useEffect(() => {
    integrationStorage.getItem('connections').then((raw) => {
      if (raw) setRecords(JSON.parse(raw) as Record<string, IntegrationRecord>);
    });
  }, []);

  async function saveRecord(item: IntegrationCatalogItem, authMode: string) {
    const next = {
      ...records,
      [item.provider]: {
        provider: item.provider,
        status: 'connected',
        authMode,
        lastSyncAt: nowIso()
      } satisfies IntegrationRecord
    };
    setRecords(next);
    await integrationStorage.setItem('connections', JSON.stringify(next));
  }

  function connect(item: IntegrationCatalogItem, authMode: string) {
    if (authMode === 'oauth' || authMode === 'sso') {
      const params = new URLSearchParams({
        provider: item.provider,
        mode: authMode,
        returnTo: window.location.href
      });
      window.open(`/api/integrations/${item.provider}/authorize?${params.toString()}`, 'admini-integration-oauth', 'width=720,height=760');
    }
    void saveRecord(item, authMode);
  }

  return (
    <section className="integrations-page">
      <header>
        <p className="mini-kicker">Integrations</p>
        <h1>Add connected systems</h1>
        <p>{connectedCount} connected. OAuth handoffs route through the Cloudflare Worker; local connection state is mirrored in IndexedDB.</p>
      </header>
      <div className="integration-grid">
        {integrationCatalog.map((item) => {
          const record = records[item.provider];
          return (
            <article className="integration-card" key={item.provider}>
              <div>
                <span className="integration-category">{item.category}</span>
                <h2>{item.name}</h2>
                <p>{item.description}</p>
              </div>
              <div className={record?.status === 'connected' ? 'connection-status connected' : 'connection-status'}>
                {record?.status === 'connected' ? `Connected via ${record.authMode}` : 'Available'}
              </div>
              <div className="integration-actions">
                {item.authModes.map((authMode) => (
                  <button type="button" key={authMode} onClick={() => connect(item, authMode)}>
                    {authMode.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <small>Persists to {item.persistenceTargets.join(' + ')}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
