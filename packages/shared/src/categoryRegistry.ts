/**
 * CategoryRegistry - Metadata-driven category-to-color mapping.
 *
 * Components consume getCategoryStyle() rather than switch-on-color-string.
 * The registry is injectable so tests can override with custom configs.
 */

export interface CategoryConfig {
  id: string;
  label: string;
  colorToken: string;
  colorHex: string;
  icon?: string;
}

export type CategoryRegistry = Map<string, CategoryConfig>;

/**
 * Look up a category's style config by ID.
 * Returns undefined if the category is not found in the registry.
 */
export function getCategoryStyle(
  categoryId: string,
  registry: CategoryRegistry
): CategoryConfig | undefined {
  return registry.get(categoryId);
}

/**
 * Get all categories from the registry as an array.
 */
export function getAllCategories(registry: CategoryRegistry): CategoryConfig[] {
  return Array.from(registry.values());
}

/**
 * Create a CategoryRegistry from an array of configs.
 * Each config is keyed by its id field.
 */
export function createRegistry(configs: CategoryConfig[]): CategoryRegistry {
  const registry: CategoryRegistry = new Map();
  for (const config of configs) {
    registry.set(config.id, config);
  }
  return registry;
}

/** Default category configurations for the AdminI application. */
export const defaultCategoryConfigs: CategoryConfig[] = [
  { id: 'compliance', label: 'Compliance', colorToken: '--color-category-orange', colorHex: '#E8A838' },
  { id: 'scheduling', label: 'Scheduling', colorToken: '--color-category-yellow', colorHex: '#E6C84D' },
  { id: 'students', label: 'Students', colorToken: '--color-category-green', colorHex: '#7BAF7B' },
  { id: 'blocked', label: 'Blocked', colorToken: '--color-category-red', colorHex: '#D63031' },
];

/** Default registry instance, ready to use. */
export const defaultRegistry: CategoryRegistry = createRegistry(defaultCategoryConfigs);
