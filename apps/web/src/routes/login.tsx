import type { AuthResponse } from '@shifu/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
export const Route = createFileRoute('/login')({
  component: Login,
});
function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
        }),
      });
      // Starter : token conservé uniquement en mémoire pour cette démonstration, non persisté.
      setMessage(`Bienvenue ${result.user.username} ! Connexion vérifiée. La gestion de session est le prochain sprint.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <Card>
        <h1 className="mb-5 text-3xl font-black">CONNEXION</h1>
        <form
          onSubmit={submit}
          className="space-y-4"
        >
          <label
            className="block text-sm font-bold"
            htmlFor="username"
          >
            Pseudo
          </label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <label
            className="block text-sm font-bold"
            htmlFor="password"
          >
            Mot de passe
          </label>
          <Input
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
          />
          <Button
            disabled={busy}
            className="arcade-button w-full"
            type="submit"
          >
            {busy ? 'Connexion…' : 'SE CONNECTER'}
          </Button>
        </form>
        <p
          className="mt-4 text-sm"
          role="status"
        >
          {message}
        </p>
        <p className="mt-4 text-sm">
          Pas de compte ?{' '}
          <Link
            to="/register"
            className="underline"
          >
            S'inscrire
          </Link>
        </p>
      </Card>
    </main>
  );
}
