import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton, SkeletonCard } from '../src/Skeleton';

describe('Skeleton', () => {
  it('renders with numeric width and height as px', () => {
    const { container } = render(<Skeleton width={200} height={40} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('40px');
  });

  it('renders with string width and height directly', () => {
    const { container } = render(<Skeleton width="50%" height="2rem" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('50%');
    expect(el.style.height).toBe('2rem');
  });

  it('applies the skeleton CSS class', () => {
    const { container } = render(<Skeleton width={100} height={20} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('skeleton');
  });

  it('appends custom className', () => {
    const { container } = render(<Skeleton width={100} height={20} className="custom" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toBe('skeleton custom');
  });

  it('applies borderRadius style when provided', () => {
    const { container } = render(<Skeleton width={100} height={20} borderRadius="8px" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.borderRadius).toBe('8px');
  });

  it('does not set borderRadius when not provided', () => {
    const { container } = render(<Skeleton width={100} height={20} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.borderRadius).toBe('');
  });

  it('sets aria-hidden="true" for accessibility', () => {
    const { container } = render(<Skeleton width={100} height={20} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SkeletonCard', () => {
  it('renders with default height of 120px', () => {
    const { container } = render(<SkeletonCard />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe('120px');
    expect(el.style.width).toBe('100%');
  });

  it('accepts numeric height override', () => {
    const { container } = render(<SkeletonCard height={200} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe('200px');
  });

  it('accepts string height override', () => {
    const { container } = render(<SkeletonCard height="50vh" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe('50vh');
  });

  it('applies skeleton and skeleton-card CSS classes', () => {
    const { container } = render(<SkeletonCard />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('skeleton');
    expect(el.className).toContain('skeleton-card');
  });

  it('appends custom className', () => {
    const { container } = render(<SkeletonCard className="extra" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toBe('skeleton skeleton-card extra');
  });

  it('sets aria-hidden="true" for accessibility', () => {
    const { container } = render(<SkeletonCard />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});