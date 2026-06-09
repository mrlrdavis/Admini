import { useState, useEffect, useCallback } from 'react';
import type { IntegrationProvider } from '@admini/shared';
import { isActiveProvider } from '@admini/integrations';
import { loadIntegrationStatuses, removeIntegrationStatus } from '../services/integrationStatusStorage';
import type { IntegrationConnectionStatus } from '../services/integrationStatusStorage';

// ---------------------------------------------------------------------------
// ConnectedIntegrations - Shows list of available integrations with status.
// ---------------------------------------------------------------------------

/** Static catalog of integrations available in AdminI */
interface IntegrationListItem {
  provider: IntegrationProvider;
  name: string;
  icon: string;
  description: string;
}

const AVAILABLE_INTEGRATIONS: IntegrationListItem[] = [
  {
    provider: 'google_classroom',
    name: 'Google Classroom',
    icon: '\uD83C\uDFEB',
    description: 'Classes, coursework, and classroom learning context',
  },
  {
    provider: 'email',
    name: 'Email',
    icon: '\u2709\uFE0F',
    description: 'Read inbox messages and send emails for communication workflows',
  },
  {
    provider: 'calendar',
    name: 'Calendar',
    icon: '\uD83D\uDCC5',
    description: 'Read and create calendar events for scheduling workflows',
  },
];

export interface ConnectedIntegrationsProps {
  /** Called when the user taps "Add Integration" */
  onAddIntegration?: () => void;
}

export function ConnectedIntegrations({ onAddIntegration }: ConnectedIntegrationsProps) {
  const [statuses, setStatuses] = useState<IntegrationConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState<IntegrationListItem | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectedProvider, setDisconnectedProvider] = useState<IntegrationProvider | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await loadIntegrationStatuses();
        if (!cancelled) {
          setStatuses(loaded.filter((s) => isActiveProvider(s.provider)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const loaded = await loadIntegrationStatuses();
      setStatuses(loaded.filter((s) => isActiveProvider(s.provider)));
    } finally {
      setRefreshing(false);
    }
  }, []);

  function getStatus(provider: IntegrationProvider): 'connected' | 'disconnected' {
    const entry = statuses.find((s) => s.provider === provider);
    return entry?.status === 'connected' ? 'connected' : 'disconnected';
  }

  const handleDisconnect = useCallback(async () => {
    if (!confirmDisconnect) return;

    setDisconnecting(true);
    try {
      await removeIntegrationStatus(confirmDisconnect.provider);
      setStatuses((prev) => prev.filter((s) => s.provider !== confirmDisconnect.provider));
      setDisconnectedProvider(confirmDisconnect.provider);
      setTimeout(() => setDisconnectedProvider(null), 2000);
    } finally {
      setDisconnecting(false);
      setConfirmDisconnect(null);
    }
  }, [confirmDisconnect]);

  if (loading) {
    return (
      <div className="connected-integrations connected-integrations--loading" aria-busy="true">
        <div className="connected-integrations__skeleton" />
        <div className="connected-integrations__skeleton" />
        <div className="connected-integrations__skeleton" />
      </div>
    );
  }

  return (
    <div className="connected-integrations" role="region" aria-label="Connected integrations">
      {/* Refresh button */}
      <button
        type="button"
        className="connected-integrations__refresh-btn"
        onClick={handleRefresh}
        disabled={refreshing}
        aria-label="Refresh connection statuses"
      >
        <span
          className={`connected-integrations__refresh-icon${refreshing ? ' connected-integrations__refresh-icon--spinning' : ''}`}
          aria-hidden="true"
        >
          &#x21BB;
        </span>
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </button>

      <ul className="connected-integrations__list" role="list">
        {AVAILABLE_INTEGRATIONS.map((integration) => {
          const status = getStatus(integration.provider);
          const justDisconnected = disconnectedProvider === integration.provider;
          return (
            <li
              key={integration.provider}
              className="connected-integrations__card"
            >
              <span className="connected-integrations__icon" aria-hidden="true">
                {integration.icon}
              </span>
              <div className="connected-integrations__info">
                <span className="connected-integrations__name">{integration.name}</span>
                <span className="connected-integrations__description">
                  {integration.description}
                </span>
              </div>

              {justDisconnected ? (
                <span className="connected-integrations__success" aria-live="polite">
                  Disconnected &#10003;
                </span>
              ) : (
                <>
                  <span
                    className={`connected-integrations__status connected-integrations__status--${status}`}
                    aria-label={`Status: ${status}`}
                  >
                    {status === 'connected' ? 'Connected' : 'Not connected'}
                  </span>

                  {status === 'connected' && (
                    <button
                      type="button"
                      className="connected-integrations__disconnect-btn"
                      onClick={() => setConfirmDisconnect(integration)}
                      aria-label={`Disconnect ${integration.name}`}
                    >
                      Disconnect
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {onAddIntegration && (
        <button
          type="button"
          className="connected-integrations__add-btn"
          onClick={onAddIntegration}
          aria-label="Add a new integration"
        >
          <span aria-hidden="true">&#x2795;</span>
          Add Integration
        </button>
      )}

      {/* Disconnect Confirmation Dialog */}
      {confirmDisconnect && (
        <div
          className="connected-integrations__confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-confirm-title"
        >
          <div className="connected-integrations__confirm-dialog">
            <h3 id="disconnect-confirm-title" className="connected-integrations__confirm-title">
              Disconnect {confirmDisconnect.name}
            </h3>
            <p className="connected-integrations__confirm-message">
              Are you sure you want to disconnect {confirmDisconnect.name}? You can reconnect it later from the integration catalog.
            </p>
            <div className="connected-integrations__confirm-actions">
              <button
                type="button"
                className="connected-integrations__btn-cancel"
                onClick={() => setConfirmDisconnect(null)}
                disabled={disconnecting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="connected-integrations__btn-disconnect"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}