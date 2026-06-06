export interface SkeletonProps {
  width: string | number;
  height: string | number;
  className?: string;
  borderRadius?: string;
}

export function Skeleton({ width, height, className, borderRadius }: SkeletonProps): JSX.Element {
  return (
    <div
      className={`skeleton${className ? ` ${className}` : ''}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius,
      }}
      aria-hidden="true"
    />
  );
}

export interface SkeletonCardProps {
  className?: string;
  height?: string | number;
}

export function SkeletonCard({ className, height = 120 }: SkeletonCardProps): JSX.Element {
  return (
    <div
      className={`skeleton skeleton-card${className ? ` ${className}` : ''}`}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  );
}
