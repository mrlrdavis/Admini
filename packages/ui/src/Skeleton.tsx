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
  height?: number;
}

export function SkeletonCard({ className, height = 80 }: SkeletonCardProps): JSX.Element {
  return (
    <div
      className={`skeleton-card${className ? ` ${className}` : ''}`}
      style={{ height: `${height}px` }}
      aria-hidden="true"
    />
  );
}