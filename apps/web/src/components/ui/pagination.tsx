import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './button';

export function Pagination({ page, pages, busy, onChange }: { page: number; pages: number; busy: boolean; onChange: (page: number) => void }) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <Button variant="outline" disabled={page <= 1 || busy} onClick={() => onChange(page - 1)} aria-label="Page précédente">
        <ArrowLeft size={18} aria-hidden="true" />
      </Button>
      <span className="arcade-chip bg-cyber px-3 py-1 text-sm font-bold" aria-live="polite">
        PAGE {page} / {pages}
      </span>
      <Button variant="outline" disabled={page >= pages || busy} onClick={() => onChange(page + 1)} aria-label="Page suivante">
        <ArrowRight size={18} aria-hidden="true" />
      </Button>
    </nav>
  );
}
