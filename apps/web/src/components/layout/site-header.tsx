import { Link, useNavigate } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';

export function SiteHeader() {
  const { user, token, signOut, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await navigate({ to: '/' });
    await signOut();
  };

  return (
    <header className="mx-auto mb-6 flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-4">
      <Link to="/" aria-label="Shifu.me, accueil" className="arcade-chip title bg-white px-3 py-1 text-xl">
        SHIFU<span className="text-coral">.ME</span>
      </Link>
      {user ? (
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <Button asChild variant="outline" className="min-w-0 flex-1 px-2 py-1.5 sm:flex-none sm:px-3">
            <Link to="/profile" aria-label={`Modifier le profil de ${user.username}, ${user.elo} Elo`}>
              <span className="shrink-0 text-2xl" aria-hidden="true">
                {user.avatar}
              </span>
              <span className="title min-w-0 truncate text-xs sm:max-w-28" title={user.username}>
                {user.username}
              </span>
              <span className="title shrink-0 rounded-md border-2 border-black bg-mint px-1.5 py-1 text-xs">
                {user.elo}
                <span className="ml-1 text-[9px]">ELO</span>
              </span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="shrink-0 px-2 text-[10px]" onClick={handleSignOut}>
            <LogOut size={14} aria-hidden="true" />
            <span>DÉCONNEXION</span>
          </Button>
        </div>
      ) : token ? (
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          DÉCONNEXION
        </Button>
      ) : !isLoading ? (
        <Button asChild variant="outline" size="sm">
          <Link to="/login">CONNEXION</Link>
        </Button>
      ) : (
        <span className="text-xs font-bold" role="status">
          Connexion…
        </span>
      )}
    </header>
  );
}
