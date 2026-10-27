import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6">
      <Link
        to="/"
        className="text-2xl font-black tracking-tight no-underline"
      >
        ✊ SHIFU.ME
      </Link>
      <nav
        aria-label="Navigation"
        className="flex flex-wrap items-center gap-3 text-sm font-black"
      >
        <Link
          to="/leaderboard"
          className="hover:underline"
        >
          CLASSEMENT
        </Link>
        <Link
          to="/history"
          className="hover:underline"
        >
          HISTORIQUE
        </Link>
        <Button
          asChild
          variant="outline"
          className="arcade-button"
        >
          <Link to="/login">CONNEXION</Link>
        </Button>
      </nav>
    </header>
  );
}
