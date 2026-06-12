import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ActivityFeed } from '../ActivityFeed';
import type { ActivityEvent } from '../../types';

// Mock the CSS import
vi.mock('../../styles/activity-feed.css', () => ({}));

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'evt-1',
    organizationId: 'org-1',
    actorId: 'user-1',
    entityType: 'task',
    entityId: 'entity-1',
    action: 'create',
    createdAt: '2024-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the "Activity Feed" title', () => {
    render(<ActivityFeed items={[makeEvent()]} />);
    expect(screen.getByText('Activity Feed')).toBeDefined();
  });

  it('renders empty state when no items', () => {
    render(<ActivityFeed items={[]} />);
    expect(screen.getByText('No recent activity')).toBeDefined();
  });

  it('renders a list element with role="list"', () => {
    render(<ActivityFeed items={[makeEvent()]} />);
    expect(screen.getByRole('list')).toBeDefined();
  });

  it('renders one list item per event', () => {
    const items = [
      makeEvent({ id: 'a' }),
      makeEvent({ id: 'b' }),
      makeEvent({ id: 'c' }),
    ];
    render(<ActivityFeed items={items} />);
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
  });

  it('displays formatted action text for create action', () => {
    render(<ActivityFeed items={[makeEvent({ action: 'create', entityType: 'task' })]} />);
    expect(screen.getByText('Created a task')).toBeDefined();
  });

  it('displays formatted action text for update action', () => {
    render(<ActivityFeed items={[makeEvent({ action: 'update', entityType: 'capture' })]} />);
    expect(screen.getByText('Updated a capture')).toBeDefined();
  });

  it('displays formatted action text for delete action', () => {
    render(<ActivityFeed items={[makeEvent({ action: 'delete', entityType: 'integration' })]} />);
    expect(screen.getByText('Deleted a integration')).toBeDefined();
  });

  it('uses green checkmark icon class for create action', () => {
    render(<ActivityFeed items={[makeEvent({ action: 'create' })]} />);
    const icon = document.querySelector('.activity-feed__icon--create');
    expect(icon).not.toBeNull();
    expect(icon?.textContent).toBe('\u2713');
  });

  it('uses blue circle icon class for update action', () => {
    render(<ActivityFeed items={[makeEvent({ action: 'update' })]} />);
    const icon = document.querySelector('.activity-feed__icon--update');
    expect(icon).not.toBeNull();
    expect(icon?.textContent).toBe('\u25CF');
  });

  it('uses default icon class for unknown actions', () => {
    render(<ActivityFeed items={[makeEvent({ action: 'archive' })]} />);
    const icon = document.querySelector('.activity-feed__icon--default');
    expect(icon).not.toBeNull();
  });

  it('displays relative timestamp for recent events', () => {
    // Event was 2 hours ago (system time is 12:00, event at 10:00)
    render(<ActivityFeed items={[makeEvent({ createdAt: '2024-06-01T10:00:00.000Z' })]} />);
    expect(screen.getByText('2h ago')).toBeDefined();
  });

  it('displays "Just now" for events less than a minute ago', () => {
    render(<ActivityFeed items={[makeEvent({ createdAt: '2024-06-01T11:59:30.000Z' })]} />);
    expect(screen.getByText('Just now')).toBeDefined();
  });

  it('displays minutes for events less than an hour ago', () => {
    render(<ActivityFeed items={[makeEvent({ createdAt: '2024-06-01T11:45:00.000Z' })]} />);
    expect(screen.getByText('15m ago')).toBeDefined();
  });

  it('displays days for events more than 24h ago', () => {
    render(<ActivityFeed items={[makeEvent({ createdAt: '2024-05-30T10:00:00.000Z' })]} />);
    expect(screen.getByText('2d ago')).toBeDefined();
  });

  it('renders time element with dateTime attribute', () => {
    const createdAt = '2024-06-01T10:00:00.000Z';
    render(<ActivityFeed items={[makeEvent({ createdAt })]} />);
    const timeEl = document.querySelector('time[datetime]');
    expect(timeEl).not.toBeNull();
    expect(timeEl?.getAttribute('datetime')).toBe(createdAt);
  });

  it('has an accessible aria-label on the section', () => {
    render(<ActivityFeed items={[makeEvent()]} />);
    expect(screen.getByLabelText('Activity feed')).toBeDefined();
  });

  it('hides icon from screen readers with aria-hidden', () => {
    render(<ActivityFeed items={[makeEvent()]} />);
    const icon = document.querySelector('.activity-feed__icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('handles unknown entity types gracefully', () => {
    render(<ActivityFeed items={[makeEvent({ entityType: 'workflow', action: 'create' })]} />);
    expect(screen.getByText('Created a workflow')).toBeDefined();
  });
});