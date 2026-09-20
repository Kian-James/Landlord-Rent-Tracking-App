import React from 'react';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

export function SkeletonText({ width = 'w-full', className = '' }) {
  return <Skeleton className={`h-3.5 ${width} ${className}`} />;
}

export function SkeletonCircle({ size = 'h-9 w-9', className = '' }) {
  return <Skeleton className={`rounded-full ${size} ${className}`} />;
}

export function SkeletonRow({ className = '' }) {
  return (
    <div className={`flex items-center justify-between py-3 ${className}`}>
      <div className="flex items-center gap-3">
        <SkeletonCircle />
        <div className="space-y-1.5">
          <SkeletonText width="w-32" />
          <SkeletonText width="w-24" className="h-3" />
        </div>
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}