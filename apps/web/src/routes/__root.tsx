import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { SiteHeader } from '@/components/layout/site-header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="arcade-card space-y-4 bg-white p-6 text-center">
      <h1 className="title text-2xl">PERDU DANS L’ARÈNE ?</h1>
      <p>Cette page n’existe pas.</p>
      <Button asChild>
        <Link to="/">RETOUR À L’ACCUEIL</Link>
      </Button>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="arcade-card space-y-4 bg-white p-6 text-center" role="alert">
      <h1 className="title text-2xl">PETIT CONTRETEMPS.</h1>
      <p>La page n’a pas pu s’afficher.</p>
      <Button onClick={reset}>RÉESSAYER</Button>
    </div>
  ),
});

function RootLayout() {
  const { notice, dismissNotice } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title =
      'Shifu.me — ' +
      ({
        '/': 'Arène Chifoumi',
        '/login': 'Connexion',
        '/register': 'Inscription',
        '/leaderboard': 'Classement',
        '/profile': 'Mon profil',
        '/history': 'Historique',
        '/rooms': 'Défier un ami',
        '/play': 'Matchmaking',
      }[pathname] ?? 'Duel en cours');
    main.current?.focus();
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh p-4 sm:p-6">
      <a href="#main" className="sr-only z-50 bg-white p-3 font-bold focus:not-sr-only focus:absolute">
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="main" ref={main} tabIndex={-1} className="mx-auto w-full max-w-3xl pb-12 outline-none">
        {notice && (
          <div role="status" className="arcade-card mb-5 flex items-center gap-3 bg-white p-4 text-sm font-bold">
            <p className="flex-1">{notice}</p>
            <button type="button" aria-label="Fermer le message" onClick={dismissNotice} className="min-h-11 min-w-11 text-xl">
              ×
            </button>
          </div>
        )}
        <Outlet />
      </main>
      <footer className="mx-auto max-w-3xl text-center text-[11px] font-bold">SHIFU.ME · PIERRE. FEUILLE. CISEAUX. RECOMMENCE.</footer>
    </div>
  );
}
