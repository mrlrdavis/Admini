import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { integrationCatalog, createMockConnector, isActiveProvider, isDeprecatedProvider } from './index';
import type { IntegrationProvider, DeprecatedIntegrationProvider, AnyIntegrationProvider } from '@admini/shared';

/**
 * Property-based tests for integration catalog invariants.
 *
 * These tests verify universal correctness properties that must hold
 * across all valid inputs, as specified in the design document.
 */

const activeProviders: IntegrationProvider[] = ['google_classroom', 'email', 'calendar'];
const deprecatedProviders: DeprecatedIntegrationProvider[] = ['schoology', 'infinite_campus'];

describe('Catalog Property Tests', () => {
  /**
   * Property 1: Catalog completeness
   * For any active IntegrationProvider value, there exists an entry in
   * integrationCatalog whose provider field matches that value.
   *
   * **Validates: Requirements 1.1, 2.1, 3.1, 4.1, 5.1**
   */
  it('Property 1: every IntegrationProvider value has a catalog entry', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...activeProviders),
        (provider) => {
          const entry = integrationCatalog.find(item => item.provider === provider);
          expect(entry).toBeDefined();
          expect(entry!.provider).toBe(provider);
        }
      )
    );
  });

  /**
   * Property 2: No deprecated providers in catalog
   * For any entry in integrationCatalog, its provider field is not a member
   * of DeprecatedIntegrationProvider.
   *
   * **Validates: Requirements 1.1, 2.1**
   */
  it('Property 2: no catalog entry has a deprecated provider', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...integrationCatalog),
        (entry) => {
          expect(deprecatedProviders).not.toContain(entry.provider);
          expect(isDeprecatedProvider(entry.provider as AnyIntegrationProvider)).toBe(false);
        }
      )
    );
  });

  /**
   * Property 4: All catalog items support OAuth
   * For any entry in integrationCatalog, the authModes array includes 'oauth'.
   *
   * **Validates: Requirements 3.2, 4.2**
   */
  it('Property 4: every catalog entry includes oauth in authModes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...integrationCatalog),
        (entry) => {
          expect(entry.authModes).toContain('oauth');
        }
      )
    );
  });

  /**
   * Property 5: Mock connector provider identity
   * For any active IntegrationProvider value p, calling createMockConnector(p)
   * returns a connector whose provider field equals p.
   *
   * **Validates: Requirements 7.1, 7.2, 7.3**
   */
  it('Property 5: for all active providers, createMockConnector(p).provider === p', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...activeProviders),
        (provider) => {
          const connector = createMockConnector(provider);
          expect(connector.provider).toBe(provider);
        }
      )
    );
  });
});