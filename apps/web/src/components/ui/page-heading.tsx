import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from './button';

export function PageHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="title text-xl sm:text-2xl">{children}</h1>
      <Button asChild variant="outline" size="sm">
        <Link to="/">
          <ArrowLeft size={16} aria-hidden="true" /> RETOUR
        </Link>
      </Button>
    </div>
  );
}
