/**
 * Unit tests for legacy service worker cleanup scripts.
 *
 * The static HTML files at public/desktop/index.html and public/mobile/index.html
 * contain inline scripts that:
 * 1. Get all service worker registrations
 * 2. Unregister any with scope including '/desktop/' or '/mobile/'
 * 3. Redirect to '/' via window.location.replace
 *
 * **Validates: Requirements 7.4**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Extracts the inline script content from an HTML file.
 */
function extractScriptContent(htmlPath: string): string {
  const html = readFileSync(htmlPath, 'utf-8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match || !match[1]) throw new Error(`No script tag found in ${htmlPath}`);
  return match[1];
}

/** Helper to create a mock registration object */
function createMockRegistration(scope: string) {
  return { scope, unregister: vi.fn().mockResolvedValue(true) };
}

describe('Legacy SW cleanup scripts', () => {
  const desktopHtmlPath = resolve(__dirname, '../../public/desktop/index.html');
  const mobileHtmlPath = resolve(__dirname, '../../public/mobile/index.html');

  let originalLocation: Location;
  let replaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    replaceMock = vi.fn();
    // Mock window.location.replace
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, replace: replaceMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe('desktop/index.html cleanup script', () => {
    it('calls unregister() on registrations scoped to /desktop/ or /mobile/', async () => {
      const desktopReg = createMockRegistration('https://example.com/desktop/');
      const mobileReg = createMockRegistration('https://example.com/mobile/');
      const rootReg = createMockRegistration('https://example.com/');

      const getRegistrationsMock = vi.fn().mockResolvedValue([desktopReg, mobileReg, rootReg]);

      Object.defineProperty(navigator, 'serviceWorker', {
        value: { getRegistrations: getRegistrationsMock },
        writable: true,
        configurable: true,
      });

      const script = extractScriptContent(desktopHtmlPath);
      const fn = new Function(script);
      fn();

      // Wait for the promise chain to resolve
      await vi.waitFor(() => {
        expect(desktopReg.unregister).toHaveBeenCalled();
      });

      expect(mobileReg.unregister).toHaveBeenCalled();
      expect(rootReg.unregister).not.toHaveBeenCalled();
    });

    it('does not call unregister() on registrations with unrelated scopes', async () => {
      const apiReg = createMockRegistration('https://example.com/api/');
      const rootReg = createMockRegistration('https://example.com/');

      const getRegistrationsMock = vi.fn().mockResolvedValue([apiReg, rootReg]);

      Object.defineProperty(navigator, 'serviceWorker', {
        value: { getRegistrations: getRegistrationsMock },
        writable: true,
        configurable: true,
      });

      const script = extractScriptContent(desktopHtmlPath);
      const fn = new Function(script);
      fn();

      // Allow async to resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(apiReg.unregister).not.toHaveBeenCalled();
      expect(rootReg.unregister).not.toHaveBeenCalled();
    });

    it('redirects to / via window.location.replace', () => {
      // Remove serviceWorker so the 'in' check fails and only the redirect runs
      const descriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
      delete (navigator as any).serviceWorker;

      const script = extractScriptContent(desktopHtmlPath);
      const fn = new Function(script);
      fn();

      expect(replaceMock).toHaveBeenCalledWith('/');

      // Restore serviceWorker property
      if (descriptor) {
        Object.defineProperty(navigator, 'serviceWorker', descriptor);
      }
    });
  });

  describe('mobile/index.html cleanup script', () => {
    it('calls unregister() on registrations scoped to /desktop/ or /mobile/', async () => {
      const desktopReg = createMockRegistration('https://example.com/desktop/');
      const mobileReg = createMockRegistration('https://example.com/mobile/');
      const rootReg = createMockRegistration('https://example.com/');

      const getRegistrationsMock = vi.fn().mockResolvedValue([desktopReg, mobileReg, rootReg]);

      Object.defineProperty(navigator, 'serviceWorker', {
        value: { getRegistrations: getRegistrationsMock },
        writable: true,
        configurable: true,
      });

      const script = extractScriptContent(mobileHtmlPath);
      const fn = new Function(script);
      fn();

      await vi.waitFor(() => {
        expect(mobileReg.unregister).toHaveBeenCalled();
      });

      expect(desktopReg.unregister).toHaveBeenCalled();
      expect(rootReg.unregister).not.toHaveBeenCalled();
    });

    it('redirects to / via window.location.replace', () => {
      // Remove serviceWorker so the 'in' check fails and only the redirect runs
      const descriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
      delete (navigator as any).serviceWorker;

      const script = extractScriptContent(mobileHtmlPath);
      const fn = new Function(script);
      fn();

      expect(replaceMock).toHaveBeenCalledWith('/');

      // Restore serviceWorker property
      if (descriptor) {
        Object.defineProperty(navigator, 'serviceWorker', descriptor);
      }
    });
  });
});
