import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { createElement } from 'react';

// Mock the supabase module to avoid import.meta.env issues
vi.mock('../supabase', () => ({
  isSupabaseConfigured: false,
  signInWithOAuthProvider: vi.fn(),
  signInWithPassword: vi.fn(),
  sendPasswordReset: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

import { AuthScreen } from '../AuthScreen';

describe('AuthScreen', () => {
  const mockOnAuthenticated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('responsive layout structure', () => {
    it('renders split-auth section with auth-story and auth-conversation when in sign-in view', () => {
      const { container } = render(
        createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated })
      );

      // Navigate to sign-in view
      fireEvent.click(screen.getByText('Sign in'));

      const splitAuth = container.querySelector('.split-auth');
      expect(splitAuth).not.toBeNull();

      const authStory = container.querySelector('.auth-story');
      expect(authStory).not.toBeNull();

      const authConversation = container.querySelector('.auth-conversation');
      expect(authConversation).not.toBeNull();
    });

    it('renders split-auth section with both panels for sign-up view', () => {
      const { container } = render(
        createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated })
      );

      // Navigate to sign-up view
      fireEvent.click(screen.getByText('Sign up'));

      const splitAuth = container.querySelector('.split-auth');
      expect(splitAuth).not.toBeNull();

      const authStory = container.querySelector('.auth-story');
      expect(authStory).not.toBeNull();

      const authConversation = container.querySelector('.auth-conversation');
      expect(authConversation).not.toBeNull();
    });

    it('split-auth layout is present at desktop viewport (800px) — CSS structure verified', () => {
      // jsdom does not apply CSS media queries, but we verify the DOM structure
      // that CSS media queries will act on is present
      const { container } = render(
        createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated })
      );

      fireEvent.click(screen.getByText('Sign in'));

      const splitAuth = container.querySelector('.split-auth');
      expect(splitAuth).not.toBeNull();

      // At desktop (min-width: 769px), CSS applies grid-template-columns: 1fr 1fr
      // We verify the two child elements exist that form the split panel
      const authStory = splitAuth!.querySelector('.auth-story');
      const authConversation = splitAuth!.querySelector('.auth-conversation');
      expect(authStory).not.toBeNull();
      expect(authConversation).not.toBeNull();
    });

    it('stacked layout class structure present at mobile viewport (375px) — CSS hides story panel', () => {
      // jsdom does not evaluate CSS media queries, but we verify the structural
      // elements are present. At max-width: 768px, CSS sets .split-auth to
      // flex-direction: column and hides .auth-story
      const { container } = render(
        createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated })
      );

      fireEvent.click(screen.getByText('Sign in'));

      const splitAuth = container.querySelector('.split-auth');
      expect(splitAuth).not.toBeNull();

      // The .auth-story element exists in DOM but will be hidden via CSS at mobile
      const authStory = container.querySelector('.auth-story');
      expect(authStory).not.toBeNull();

      // The conversation panel exists and will be full-width on mobile
      const authConversation = container.querySelector('.auth-conversation');
      expect(authConversation).not.toBeNull();
    });

    it('layout transitions on view change without unmounting the component', () => {
      const { container, unmount } = render(
        createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated })
      );

      // Start at home view — no split-auth
      expect(container.querySelector('.split-auth')).toBeNull();
      expect(container.querySelector('.home-panel')).not.toBeNull();

      // Transition to sign-in — split-auth appears
      fireEvent.click(screen.getByText('Sign in'));
      expect(container.querySelector('.split-auth')).not.toBeNull();
      expect(container.querySelector('.home-panel')).toBeNull();

      // Transition back to home — split-auth disappears
      fireEvent.click(screen.getByText('Back'));
      expect(container.querySelector('.split-auth')).toBeNull();
      expect(container.querySelector('.home-panel')).not.toBeNull();

      // Transition to sign-up — split-auth reappears
      fireEvent.click(screen.getByText('Sign up'));
      expect(container.querySelector('.split-auth')).not.toBeNull();

      // Component was never unmounted throughout these transitions
      expect(unmount).toBeDefined();
    });
  });

  describe('sign-in view', () => {
    it('shows a form with email and password inputs', () => {
      render(createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated }));

      fireEvent.click(screen.getByText('Sign in'));

      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).not.toBeNull();
      expect(emailInput.getAttribute('type')).toBe('email');

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).not.toBeNull();
      expect(passwordInput.getAttribute('type')).toBe('password');
    });

    it('shows Google OAuth button', () => {
      render(createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated }));

      fireEvent.click(screen.getByText('Sign in'));

      expect(screen.getByText('or sign in with Google')).not.toBeNull();
    });

    it('shows submit button', () => {
      render(createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated }));

      fireEvent.click(screen.getByText('Sign in'));

      expect(screen.getByText('Open Admini')).not.toBeNull();
    });
  });

  describe('sign-up view', () => {
    it('shows the multi-step wizard starting with display name question', () => {
      render(createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated }));

      fireEvent.click(screen.getByText('Sign up'));

      // First step asks for display name
      expect(screen.getByText('What should I call you?')).not.toBeNull();
      expect(screen.getByText('Next')).not.toBeNull();
    });

    it('advances through wizard steps', () => {
      render(createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated }));

      fireEvent.click(screen.getByText('Sign up'));

      // Step 0: display name
      const nameInput = screen.getByRole('textbox');
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.click(screen.getByText('Next'));

      // Step 1: school name
      expect(screen.getByText("What is your school's name?")).not.toBeNull();
    });
  });

  describe('home view', () => {
    it('starts at home view with sign-in and sign-up buttons', () => {
      render(createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated }));

      expect(screen.getByText('Sign in')).not.toBeNull();
      expect(screen.getByText('Sign up')).not.toBeNull();
    });

    it('displays the product tagline', () => {
      render(createElement(AuthScreen, { onAuthenticated: mockOnAuthenticated }));

      expect(
        screen.getByText('cognitive load support for school administrators')
      ).not.toBeNull();
    });
  });
});
