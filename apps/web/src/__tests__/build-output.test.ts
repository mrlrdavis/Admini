// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Integration test: Build output validation
 *
 * Validates: Requirements 4.1, 3.1, 3.6
 *
 * Verifies that `npm run build:app` produces a single deployable output
 * directory with the expected PWA assets and manifest configuration.
 */

const distDir = resolve(__dirname, '../../../../dist/netlify');

describe('Build output validation', () => {
  it('dist/netlify/index.html exists', () => {
    expect(existsSync(resolve(distDir, 'index.html'))).toBe(true);
  });

  it('dist/netlify/sw.js exists', () => {
    expect(existsSync(resolve(distDir, 'sw.js'))).toBe(true);
  });

  it('dist/netlify/manifest.webmanifest exists', () => {
    expect(existsSync(resolve(distDir, 'manifest.webmanifest'))).toBe(true);
  });

  describe('manifest.webmanifest fields', () => {
    const manifestPath = resolve(distDir, 'manifest.webmanifest');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    it('name is "AdminI"', () => {
      expect(manifest.name).toBe('AdminI');
    });

    it('start_url is "/"', () => {
      expect(manifest.start_url).toBe('/');
    });

    it('scope is "/"', () => {
      expect(manifest.scope).toBe('/');
    });

    it('icons include 192x192 and 512x512 sizes', () => {
      const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
      expect(sizes).toContain('192x192');
      expect(sizes).toContain('512x512');
    });
  });

  describe('no second app output directory', () => {
    it('dist/netlify/desktop/ does not contain a second app build', () => {
      // desktop/index.html exists as the legacy SW cleanup redirect page
      // but there should be NO additional app assets (js bundles, css, etc.)
      const desktopDir = resolve(distDir, 'desktop');
      if (existsSync(desktopDir)) {
        // Only index.html should exist (the legacy redirect stub)
        const desktopIndex = resolve(desktopDir, 'index.html');
        expect(existsSync(desktopIndex)).toBe(true);

        // Verify it's the redirect stub, not a full app
        const content = readFileSync(desktopIndex, 'utf-8');
        expect(content).toContain('window.location.replace');
        expect(content).not.toContain('id="root"');
      }
    });

    it('dist/netlify/mobile/ does not contain a second app build', () => {
      const mobileDir = resolve(distDir, 'mobile');
      if (existsSync(mobileDir)) {
        const mobileIndex = resolve(mobileDir, 'index.html');
        expect(existsSync(mobileIndex)).toBe(true);

        // Verify it's the redirect stub, not a full app
        const content = readFileSync(mobileIndex, 'utf-8');
        expect(content).toContain('window.location.replace');
        expect(content).not.toContain('id="root"');
      }
    });
  });
});
