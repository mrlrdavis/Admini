import { useState } from 'react';
import { integrationCatalog } from '@admini/integrations';
import type { IntegrationCatalogItem, IntegrationProvider } from '@admini/shared';
import { saveIntegrationStatus } from '../services/integrationStatusStorage';
import type { IntegrationConnectionStatus } from '../services/integrationStatusStorage';

// ---------------------------------------------------------------------------
// IntegrationCatalog - Shows available integrations the user can connect.
// Extracted from desktop App.tsx IntegrationsPanel for cross-platform reuse.
// ---------------------------------------------------------------------------

export interface IntegrationCatalogProps {
  /** Called after a successful connection to refresh parent state */
  onConnected?: () => void;
  /** Called when user wants to go back to the connected list */
  onBack?: () => void;
}

export function IntegrationCatalog({ onConnected, onBack }: IntegrationCatalogProps) {
  const [connecting, setConnecting] = useState<IntegrationProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(item: IntegrationCatalogItem) {
    setConnecting(item.provider);
    setError(null);

    try {
      const entry: IntegrationConnectionStatus = {
        provider: item.provider,
        status: 'connected',
        connectedAt: new Date().toISOString(),
      };
      await saveIntegrationStatus(entry);
      onConnected?.();
    } catch {
      setError('Failed to connect ' + item.name + '. Please try again.');
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div className="integration-catalog" role="region" aria-label="Integration catalog">
      {onBack && (
        <button
          type="button"
          className="integration-catalog__back-btn"
          onClick={onBack}
          aria-label="Back to connected apps"
        >
          {'\u2190'} Back to Connected Apps
        </button>
      )}

      <p className="integration-catalog__description">
        Choose a system to connect. Once connected, it will appear in your Connected Apps list.
      </p>

      {error && (
        <p className="integration-catalog__error" role="alert">
          {error}
        </p>
      )}

      <ul className="integration-catalog__list" role="list">
        {integrationCatalog.map((item) => {
          const isConnecting = connecting === item.provider;
          return (
            <li key={item.provider} className="integration-catalog__card">
              <span className="integration-catalog__icon" aria-hidden="true">
                {getProviderIcon(item.provider)}
              </span>
              <div className="integration-catalog__info">
                <span className="integration-catalog__name">{item.name}</span>
                <span className="integration-catalog__card-description">
                  {item.description}
                </span>
                <span className="integration-catalog__category">
                  {item.category.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                className="integration-catalog__connect-btn"
                disabled={isConnecting}
                onClick={() => handleConnect(item)}
                aria-label={'Connect ' + item.name}
              >
                {isConnecting ? 'Connecting\u2026' : 'Connect'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProviderIcon(provider: IntegrationProvider): string {
  switch (provider) {
    case 'google_classroom': return '\uD83C\uDFEB';
    case 'schoology': return '\uD83D\uDCDA';
    case 'infinite_campus': return '\uD83C\uDFE2';
    default: return '\uD83D\uDD17';
  }
}