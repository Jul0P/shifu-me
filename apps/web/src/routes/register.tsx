import type { AuthResponse } from '@shifu/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
export const Route = createFileRoute('/register')({
  component: Register,
});
function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await apiFetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
        }),
      });
      setMessage(`Compte créé pour ${result.user.username} (100 Elo). Connecte-toi pour la suite.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Inscription impossible');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <Card>
        <h1 className="mb-5 text-3xl font-black">INSCRIPTION</h1>
        <form
          onSubmit={submit}
          className="space-y-4"
        >
          <label
            htmlFor="username"
            className="block text-sm font-bold"
          >
            Pseudo (3 à 24 caractères)
          </label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={24}
            autoComplete="username"
            required
          />
          <label
            htmlFor="password"
            className="block text-sm font-bold"
          >
            Mot de passe (8 caractères minimum)
          </label>
          <Input
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            type="password"
            autoComplete="new-password"
            required
          />
          <Button
            disabled={busy}
            className="arcade-button w-full"
            type="submit"
          >
            {busy ? 'Création…' : 'CRÉER MON COMPTE'}
          </Button>
        </form>
        <p
          className="mt-4 text-sm"
          role="status"
        >
          {message}
        </p>
        <p className="mt-4 text-sm">
          Déjà inscrit ?{' '}
          <Link
            to="/login"
            className="underline"
          >
            Se connecter
          </Link>
        </p>
      </Card>
    </main>
  );
}
