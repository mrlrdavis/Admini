import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggleTheme };
}

export const navViews = ['dashboard', 'capture', 'tasks', 'observations', 'integrations', 'settings'] as const;
export type NavView = (typeof navViews)[number];
