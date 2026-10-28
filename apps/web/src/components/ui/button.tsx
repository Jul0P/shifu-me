import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva('arcade-button inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-center disabled:opacity-45', {
  variants: {
    variant: {
      default: 'bg-mint hover:bg-emerald-300',
      outline: 'bg-white hover:bg-neutral-50',
      destructive: 'bg-coral hover:bg-rose-300',
      yellow: 'bg-cyber hover:bg-yellow-200',
    },
    size: { default: '', sm: 'min-h-11 px-3 text-xs', lg: 'min-h-14 px-6 py-3 text-base' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type = 'button', ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';

  return <Component type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
