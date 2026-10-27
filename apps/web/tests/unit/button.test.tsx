import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('affiche son libellé', () => {
    render(<Button>JOUER</Button>);
    expect(
      screen.getByRole('button', {
        name: 'JOUER',
      }),
    ).toBeInTheDocument();
  });
});
