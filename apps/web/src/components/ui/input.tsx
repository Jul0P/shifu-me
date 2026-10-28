import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('arcade-chip min-h-12 w-full bg-white px-3 py-2 font-bold focus:bg-yellow-50 disabled:opacity-50', className)} {...props} />;
}
