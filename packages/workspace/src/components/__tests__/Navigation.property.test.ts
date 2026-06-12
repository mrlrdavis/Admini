import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterTabsByRole as desktopFilterTabsByRole } from '../DesktopSidebar';
import { filterTabsByRole as mobileFilterTabsByRole } from '../MobileTabBar';
import type { DesktopSidebarTabItem } from '../DesktopSidebar';
import type { MobileTabBarTabItem } from '../MobileTabBar';
import type { AdminiRole } from '../../types';

// Feature: app-ui-overhaul, Property 3: Role-gating hides restricted navigation

/**
 * Property 3: Role-gating hides restricted navigation
 *
 * For any user role that is not `admin` or `principal`, the sidebar and tab bar
 * SHALL exclude the Admin and Observations navigation items from the rendered output.
 *
 * **Validates: Requirements 4.4, 19.5**
 */

// All valid AdminiRole values
const ALL_ROLES: AdminiRole[] = ['admin', 'principal', 'teacher', 'staff'];
const NON_PRIVILEGED_ROLES: AdminiRole[] = ['teacher', 'staff'];

// Arbitrary for non-admin/non-principal roles
const nonPrivilegedRoleArb = fc.constantFrom<AdminiRole>(...NON_PRIVILEGED_ROLES);

// Arbitrary for any AdminiRole
const anyRoleArb = fc.constantFrom<AdminiRole>(...ALL_ROLES);

// Tabs that require admin/principal access (the restricted tabs)
const RESTRICTED_TABS_DESKTOP: DesktopSidebarTabItem[] = [
  { id: 'admin', label: 'Admin', icon: null as unknown as React.ReactNode, requiredRoles: ['admin', 'principal'] },
  { id: 'observations', label: 'Observations', icon: null as unknown as React.ReactNode, requiredRoles: ['admin', 'principal'] },
];

// Tabs available to everyone (no role restriction)
const UNRESTRICTED_TABS_DESKTOP: DesktopSidebarTabItem[] = [
  { id: 'capture', label: 'Capture', icon: null as unknown as React.ReactNode },
  { id: 'dashboard', label: 'Dashboard', icon: null as unknown as React.ReactNode },
  { id: 'tasks', label: 'Tasks', icon: null as unknown as React.ReactNode },
  { id: 'notes', label: 'Notes', icon: null as unknown as React.ReactNode },
  { id: 'pulse', label: 'Pulse', icon: null as unknown as React.ReactNode },
  { id: 'more', label: 'Settings', icon: null as unknown as React.ReactNode },
];

const ALL_TABS_DESKTOP: DesktopSidebarTabItem[] = [...UNRESTRICTED_TABS_DESKTOP, ...RESTRICTED_TABS_DESKTOP];

// Same tabs for the mobile tab bar type
const RESTRICTED_TABS_MOBILE: MobileTabBarTabItem[] = [
  { id: 'admin', label: 'Admin', icon: null as unknown as React.ReactNode, requiredRoles: ['admin', 'principal'] },
  { id: 'observations', label: 'Observations', icon: null as unknown as React.ReactNode, requiredRoles: ['admin', 'principal'] },
];

const UNRESTRICTED_TABS_MOBILE: MobileTabBarTabItem[] = [
  { id: 'capture', label: 'Capture', icon: null as unknown as React.ReactNode },
  { id: 'dashboard', label: 'Dashboard', icon: null as unknown as React.ReactNode },
  { id: 'tasks', label: 'Tasks', icon: null as unknown as React.ReactNode },
  { id: 'notes', label: 'Notes', icon: null as unknown as React.ReactNode },
  { id: 'pulse', label: 'Pulse', icon: null as unknown as React.ReactNode },
  { id: 'more', label: 'Settings', icon: null as unknown as React.ReactNode },
];

const ALL_TABS_MOBILE: MobileTabBarTabItem[] = [...UNRESTRICTED_TABS_MOBILE, ...RESTRICTED_TABS_MOBILE];

describe('Navigation Property Tests', () => {
  // Feature: app-ui-overhaul, Property 3: Role-gating hides restricted navigation
  describe('Property 3: Role-gating hides restricted navigation', () => {
    it('DesktopSidebar filterTabsByRole excludes Admin and Observations for non-admin/non-principal roles', () => {
      fc.assert(
        fc.property(
          nonPrivilegedRoleArb,
          (role) => {
            const result = desktopFilterTabsByRole(ALL_TABS_DESKTOP, role);
            const resultIds = result.map((tab) => tab.id);

            // Admin and Observations must NOT appear in the result
            expect(resultIds).not.toContain('admin');
            expect(resultIds).not.toContain('observations');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('MobileTabBar filterTabsByRole excludes Admin and Observations for non-admin/non-principal roles', () => {
      fc.assert(
        fc.property(
          nonPrivilegedRoleArb,
          (role) => {
            const result = mobileFilterTabsByRole(ALL_TABS_MOBILE, role);
            const resultIds = result.map((tab) => tab.id);

            // Admin and Observations must NOT appear in the result
            expect(resultIds).not.toContain('admin');
            expect(resultIds).not.toContain('observations');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('DesktopSidebar filterTabsByRole includes Admin and Observations for admin/principal roles', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<AdminiRole>('admin', 'principal'),
          (role) => {
            const result = desktopFilterTabsByRole(ALL_TABS_DESKTOP, role);
            const resultIds = result.map((tab) => tab.id);

            // Admin and Observations MUST appear for privileged roles
            expect(resultIds).toContain('admin');
            expect(resultIds).toContain('observations');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('MobileTabBar filterTabsByRole includes Admin and Observations for admin/principal roles', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<AdminiRole>('admin', 'principal'),
          (role) => {
            const result = mobileFilterTabsByRole(ALL_TABS_MOBILE, role);
            const resultIds = result.map((tab) => tab.id);

            // Admin and Observations MUST appear for privileged roles
            expect(resultIds).toContain('admin');
            expect(resultIds).toContain('observations');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Both implementations produce identical filtering results for any role', () => {
      fc.assert(
        fc.property(
          anyRoleArb,
          (role) => {
            const desktopResult = desktopFilterTabsByRole(ALL_TABS_DESKTOP, role);
            const mobileResult = mobileFilterTabsByRole(ALL_TABS_MOBILE, role);

            // Both should produce the same set of visible tab IDs
            const desktopIds = desktopResult.map((tab) => tab.id).sort();
            const mobileIds = mobileResult.map((tab) => tab.id).sort();
            expect(desktopIds).toEqual(mobileIds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
