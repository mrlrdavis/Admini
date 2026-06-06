import React from 'react';

export interface KPICardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  switch (trend) {
    case 'up':
      return <span className="kpi-card__trend kpi-card__trend--up" aria-label="Trending up">↑</span>;
    case 'down':
      return <span className="kpi-card__trend kpi-card__trend--down" aria-label="Trending down">↓</span>;
    case 'neutral':
      return <span className="kpi-card__trend kpi-card__trend--neutral" aria-label="No change">→</span>;
  }
}

export function KPICard({ label, value, trend }: KPICardProps): JSX.Element {
  return (
    <div className="kpi-card">
      <span className="kpi-card__label">{label}</span>
      <span className="kpi-card__value">{String(value)}</span>
      {trend && <TrendIndicator trend={trend} />}
    </div>
  );
}
