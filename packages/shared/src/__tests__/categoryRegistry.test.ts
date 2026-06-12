/**
 * Unit tests for CategoryRegistry module.
 *
 * Covers: createRegistry, getCategoryStyle, getAllCategories,
 * defaultCategoryConfigs, and defaultRegistry exports.
 */

import { describe, it, expect } from 'vitest';
import {
  createRegistry,
  getCategoryStyle,
  getAllCategories,
  defaultCategoryConfigs,
  defaultRegistry,
  type CategoryConfig,
  type CategoryRegistry,
} from '../categoryRegistry';

// ---------------------------------------------------------------------------
// createRegistry
// ---------------------------------------------------------------------------

describe('createRegistry', () => {
  it('creates an empty registry from an empty array', () => {
    const registry = createRegistry([]);
    expect(registry.size).toBe(0);
  });

  it('creates a registry keyed by config id', () => {
    const configs: CategoryConfig[] = [
      { id: 'alpha', label: 'Alpha', colorToken: '--alpha', colorHex: '#AAA' },
      { id: 'beta', label: 'Beta', colorToken: '--beta', colorHex: '#BBB' },
    ];
    const registry = createRegistry(configs);

    expect(registry.size).toBe(2);
    expect(registry.has('alpha')).toBe(true);
    expect(registry.has('beta')).toBe(true);
  });

  it('last config wins when duplicate ids are provided', () => {
    const configs: CategoryConfig[] = [
      { id: 'dup', label: 'First', colorToken: '--first', colorHex: '#111' },
      { id: 'dup', label: 'Second', colorToken: '--second', colorHex: '#222' },
    ];
    const registry = createRegistry(configs);

    expect(registry.size).toBe(1);
    expect(registry.get('dup')?.label).toBe('Second');
  });

  it('preserves optional icon field when provided', () => {
    const configs: CategoryConfig[] = [
      { id: 'with-icon', label: 'Icon', colorToken: '--icon', colorHex: '#000', icon: '??' },
    ];
    const registry = createRegistry(configs);

    expect(registry.get('with-icon')?.icon).toBe('??');
  });

  it('leaves icon undefined when not provided', () => {
    const configs: CategoryConfig[] = [
      { id: 'no-icon', label: 'No Icon', colorToken: '--no', colorHex: '#FFF' },
    ];
    const registry = createRegistry(configs);

    expect(registry.get('no-icon')?.icon).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getCategoryStyle
// ---------------------------------------------------------------------------

describe('getCategoryStyle', () => {
  const testRegistry: CategoryRegistry = createRegistry([
    { id: 'compliance', label: 'Compliance', colorToken: '--orange', colorHex: '#E8A838' },
    { id: 'students', label: 'Students', colorToken: '--green', colorHex: '#7BAF7B' },
  ]);

  it('returns the config for an existing category id', () => {
    const result = getCategoryStyle('compliance', testRegistry);
    expect(result).toEqual({
      id: 'compliance',
      label: 'Compliance',
      colorToken: '--orange',
      colorHex: '#E8A838',
    });
  });

  it('returns undefined for a non-existent category id', () => {
    const result = getCategoryStyle('nonexistent', testRegistry);
    expect(result).toBeUndefined();
  });

  it('returns undefined for an empty string id', () => {
    const result = getCategoryStyle('', testRegistry);
    expect(result).toBeUndefined();
  });

  it('is case-sensitive', () => {
    const result = getCategoryStyle('Compliance', testRegistry);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAllCategories
// ---------------------------------------------------------------------------

describe('getAllCategories', () => {
  it('returns an empty array for an empty registry', () => {
    const registry = createRegistry([]);
    expect(getAllCategories(registry)).toEqual([]);
  });

  it('returns all configs from the registry', () => {
    const configs: CategoryConfig[] = [
      { id: 'a', label: 'A', colorToken: '--a', colorHex: '#A' },
      { id: 'b', label: 'B', colorToken: '--b', colorHex: '#B' },
      { id: 'c', label: 'C', colorToken: '--c', colorHex: '#C' },
    ];
    const registry = createRegistry(configs);
    const result = getAllCategories(registry);

    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns an array (not a Map iterator)', () => {
    const registry = createRegistry([
      { id: 'x', label: 'X', colorToken: '--x', colorHex: '#X' },
    ]);
    const result = getAllCategories(registry);

    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Default exports
// ---------------------------------------------------------------------------

describe('defaultCategoryConfigs', () => {
  it('contains exactly 4 default categories', () => {
    expect(defaultCategoryConfigs).toHaveLength(4);
  });

  it('includes compliance, scheduling, students, and blocked', () => {
    const ids = defaultCategoryConfigs.map((c) => c.id);
    expect(ids).toContain('compliance');
    expect(ids).toContain('scheduling');
    expect(ids).toContain('students');
    expect(ids).toContain('blocked');
  });

  it('each config has required fields', () => {
    for (const config of defaultCategoryConfigs) {
      expect(config.id).toBeTruthy();
      expect(config.label).toBeTruthy();
      expect(config.colorToken).toMatch(/^--/);
      expect(config.colorHex).toMatch(/^#/);
    }
  });
});

describe('defaultRegistry', () => {
  it('is a pre-built registry from defaultCategoryConfigs', () => {
    expect(defaultRegistry.size).toBe(defaultCategoryConfigs.length);
  });

  it('allows lookup of default categories via getCategoryStyle', () => {
    const compliance = getCategoryStyle('compliance', defaultRegistry);
    expect(compliance).toBeDefined();
    expect(compliance?.colorHex).toBe('#E8A838');
  });

  it('sage green accent color is used for students category', () => {
    const students = getCategoryStyle('students', defaultRegistry);
    expect(students?.colorHex).toBe('#7BAF7B');
  });
});
