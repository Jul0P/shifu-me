import type * as React from 'react';
import { cn } from '@/lib/utils';
export function Badge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="badge"
      className={cn('inline-flex items-center rounded-md border-2 border-black bg-white px-2 py-1 text-xs font-black', className)}
      {...props}
    />
  );
}
