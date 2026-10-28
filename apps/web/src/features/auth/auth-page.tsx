import { AVATARS, authResponseSchema, loginSchema, registerSchema } from '@shifu/shared';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Feedback, FormMessage } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { AvatarPicker } from '@/features/profile/avatar-picker';
import { apiRequest } from '@/lib/api-client';
import { useAuth } from './auth-context';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const register = mode === 'register';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<(typeof AVATARS)[number]>(AVATARS[0]);
  const [validation, setValidation] = useState('');
  const submit = useMutation({
    mutationFn: (body: { username: string; password: string; avatar?: string }) => apiRequest(`/api/auth/${mode}`, authResponseSchema, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (response) => {
      setPassword('');
      auth.signIn(response);
      void navigate({ to: '/' });
    },
  });

  if (auth.user) {
    return <Navigate to="/" replace />;
  }

  if (auth.isLoading || auth.error) {
    return <Feedback title="Retrouver ma session" loading={auth.isLoading} error={auth.error} onRetry={auth.error ? auth.retry : undefined} />;
  }

  return (
    <section className="arcade-card space-y-5 bg-white p-5 sm:p-6">
      <nav aria-label="Authentification" className="grid grid-cols-2 gap-3">
        <Button asChild variant={register ? 'yellow' : 'outline'}>
          <Link to="/register" aria-current={register ? 'page' : undefined}>
            INSCRIPTION
          </Link>
        </Button>
        <Button asChild variant={!register ? 'yellow' : 'outline'}>
          <Link to="/login" aria-current={!register ? 'page' : undefined}>
            CONNEXION
          </Link>
        </Button>
      </nav>
      <div>
        <h1 className="title text-2xl">{register ? 'BIENVENUE DANS L’ARÈNE.' : 'DE RETOUR POUR UN DUEL ?'}</h1>
        <p className="mt-2 text-sm font-bold">{register ? 'Un pseudo, un avatar. Et 100 Elo pour commencer.' : 'Retrouve ton profil, ton score et tes matchs.'}</p>
      </div>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit.reset();
          const result = (register ? registerSchema : loginSchema).safeParse(register ? { username, password, avatar } : { username, password });

          if (!result.success) {
            const issue = result.error.issues[0];

            setValidation(issue?.path[0] === 'password' ? (register ? issue.message : 'Renseigne un mot de passe valide.') : 'Choisis un pseudo de 3 à 24 caractères (lettres, chiffres, _ ou -).');
            return;
          }

          setValidation('');
          submit.mutate(result.data);
        }}
      >
        <div className="space-y-1">
          <label htmlFor="auth-username" className="title text-xs">
            PSEUDO
          </label>
          <Input id="auth-username" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={24} required disabled={submit.isPending} aria-describedby="auth-help" />
          <p id="auth-help" className="text-xs font-bold text-neutral-600">
            3 à 24 caractères : lettres, chiffres, _ ou -.
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="auth-password" className="title text-xs">
            MOT DE PASSE
          </label>
          <Input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={72}
            minLength={register ? 12 : undefined}
            required
            disabled={submit.isPending}
            aria-describedby={register ? 'password-help' : undefined}
          />
          {register && (
            <p id="password-help" className="text-xs font-bold text-neutral-600">
              Au moins 12 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial.
            </p>
          )}
        </div>
        {register && <AvatarPicker value={avatar} onChange={setAvatar} disabled={submit.isPending} />}
        {validation && (
          <p role="alert" className="text-sm font-bold text-rose-800">
            {validation}
          </p>
        )}
        <FormMessage error={submit.error} />
        <Button type="submit" size="lg" className="w-full" disabled={submit.isPending}>
          {submit.isPending ? 'UN INSTANT…' : register ? 'CRÉER MON COMPTE' : 'ME CONNECTER'}
        </Button>
      </form>
      <Link to="/" className="inline-flex min-h-11 items-center text-xs font-bold underline">
        ← retour à l’accueil
      </Link>
    </section>
  );
}
