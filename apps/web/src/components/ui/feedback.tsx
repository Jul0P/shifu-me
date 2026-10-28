import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { errorMessage } from '@/lib/api-client';
import { Button } from './button';

type FeedbackProps = { title: string; message?: string; error?: unknown; loading?: boolean; onRetry?: () => void };

export function Feedback({ title, message, error, loading, onRetry }: FeedbackProps) {
  return (
    <div className="arcade-card space-y-3 bg-white p-6 text-center" role={error ? 'alert' : 'status'}>
      {loading ? <LoaderCircle className="mx-auto motion-safe:animate-spin" aria-hidden="true" /> : error ? <TriangleAlert className="mx-auto" aria-hidden="true" /> : null}
      <h2 className="title text-lg">{title}</h2>
      {Boolean(message || error) && <p className="text-sm font-bold">{error ? errorMessage(error) : message}</p>}
      {onRetry && (
        <Button variant="yellow" onClick={onRetry}>
          RÉESSAYER
        </Button>
      )}
    </div>
  );
}

export function FormMessage({ error, message }: { error?: unknown; message?: string }) {
  if (!error && !message) {
    return null;
  }

  return (
    <p role={error ? 'alert' : 'status'} className={error ? 'text-sm font-bold text-rose-800' : 'text-sm font-bold text-emerald-800'}>
      {error ? errorMessage(error) : message}
    </p>
  );
}
