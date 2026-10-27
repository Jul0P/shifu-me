import type * as React from 'react';
import { cn } from '@/lib/utils';
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-xl border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]', className)}
      {...props}
    />
  );
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('mb-3 flex flex-col gap-1', className)}
      {...props}
    />
  );
}
export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-xl font-black', className)}
      {...props}
    />
  );
}
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('text-sm', className)}
      {...props}
    />
  );
}
