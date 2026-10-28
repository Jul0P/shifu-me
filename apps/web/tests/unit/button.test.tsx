import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../../src/components/ui/button';
import { FormMessage } from '../../src/components/ui/feedback';
import { cn } from '../../src/lib/utils';

describe('Composants et classes partagés', () => {
  it('ne soumet pas un formulaire par défaut et conserve un type explicite', () => {
    expect(renderToStaticMarkup(<Button>Action</Button>)).toContain('type="button"');
    expect(renderToStaticMarkup(<Button type="submit">Envoyer</Button>)).toContain('type="submit"');
  });

  it('conserve la variante, les classes personnalisées et l’état désactivé', () => {
    const html = renderToStaticMarkup(
      <Button variant="destructive" className="w-full" disabled>
        Supprimer
      </Button>,
    );
    expect(html).toContain('bg-coral');
    expect(html).toContain('w-full');
    expect(html).toContain('disabled=""');
  });

  it('rend le lien enfant sans ajouter de bouton ni de type HTML inadapté', () => {
    const html = renderToStaticMarkup(
      <Button asChild>
        <a href="/profile">Profil</a>
      </Button>,
    );
    expect(html).toContain('<a ');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('type=');
  });

  it('fusionne les classes Tailwind conflictuelles en gardant la dernière', () => {
    expect(cn('px-4', false, 'px-2')).toBe('px-2');
  });

  it('ne rend aucun message vide et annonce une information non bloquante', () => {
    expect(renderToStaticMarkup(<FormMessage />)).toBe('');
    expect(renderToStaticMarkup(<FormMessage message="Enregistré" />)).toContain('role="status"');
  });
});
