import type * as React from 'react';
import { cn } from '@/lib/utils';
export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn('h-11 w-full rounded-lg border-2 border-black bg-white px-3 text-sm outline-offset-2', className)}
      {...props}
    />
  );
}
