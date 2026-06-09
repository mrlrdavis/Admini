import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppPreferences } from './AppPreferences';

describe('AppPreferences - Task Recommendations toggle', () => {
  const defaultOnChange = vi.fn();

  it('renders the toggle with aria-checked="true" by default (enabled)', () => {
    render(<AppPreferences onChange={defaultOnChange} />);

    const toggle = screen.getByRole('switch', { name: /task recommendations/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('renders the toggle with aria-checked="false" when taskRecommendationsEnabled is false', () => {
    render(
      <AppPreferences onChange={defaultOnChange} taskRecommendationsEnabled={false} />
    );

    const toggle = screen.getByRole('switch', { name: /task recommendations/i });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('calls onChange with "taskRecommendationsEnabled" and false when toggling off', () => {
    const onChange = vi.fn();
    render(<AppPreferences onChange={onChange} taskRecommendationsEnabled={true} />);

    const toggle = screen.getByRole('switch', { name: /task recommendations/i });
    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith('taskRecommendationsEnabled', false);
  });

  it('calls onChange with "taskRecommendationsEnabled" and true when toggling on', () => {
    const onChange = vi.fn();
    render(<AppPreferences onChange={onChange} taskRecommendationsEnabled={false} />);

    const toggle = screen.getByRole('switch', { name: /task recommendations/i });
    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith('taskRecommendationsEnabled', true);
  });

  it('updates aria-checked after clicking the toggle', () => {
    const onChange = vi.fn();
    render(<AppPreferences onChange={onChange} taskRecommendationsEnabled={true} />);

    const toggle = screen.getByRole('switch', { name: /task recommendations/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });
});
