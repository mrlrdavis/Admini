import { useEffect, useState, type FormEvent } from 'react';
import {
  isSupabaseConfigured,
  signInWithOAuthProvider,
  signInWithPassword,
  sendPasswordReset,
  signUpWithPassword,
  type AuthUser
} from './supabase';
import './auth-screen.css';

type AuthView = 'home' | 'sign-in' | 'sign-up';
type VisualMode = 'day' | 'night';

let hoverAudioContext: AudioContext | null = null;
const defaultReturningUserTagline = "we'll take it from here";
const returningUserTaglines = [
  defaultReturningUserTagline,
  'put down those sticky notes',
  'need another coffee?',
  'clear the desk, keep the day'
];

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

function BreathingOverlay({ onClose }: { onClose: () => void }) {
  return (
    <section className="breathing-overlay" aria-live="polite">
      <button className="breathing-overlay__close" type="button" onClick={onClose} aria-label="Close breathing exercise">&times;</button>
      <div className="breath-orb" />
      <p>inhale</p>
      <span>exhale</span>
    </section>
  );
}
export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
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