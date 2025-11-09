'use client';

import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'glass-panel border border-white/5 bg-gradient-to-br from-white/5 via-transparent to-white/5',
        className,
      )}
      {...props}
    />
  );
}
