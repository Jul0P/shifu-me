import { AVATARS, type PublicUser, publicUserSchema, updateProfileSchema } from '@shifu/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { apiRequest } from '@/lib/api-client';
import { AvatarPicker } from './avatar-picker';

export function ProfileForm({ user }: { user: PublicUser }) {
  const { token } = useAuth();
  const client = useQueryClient();
  const [username, setUsername] = useState(user.username);
  const [avatar, setAvatar] = useState<(typeof AVATARS)[number] | undefined>(AVATARS.find((item) => item === user.avatar));
  const [validation, setValidation] = useState('');
  const update = useMutation({
    mutationFn: (body: { username?: string; avatar?: string }) => apiRequest('/api/users/me', publicUserSchema, { method: 'PUT', token, body: JSON.stringify(body) }),
    onSuccess: async (profile) => {
      await client.cancelQueries({ queryKey: ['profile', user.id] });
      client.setQueryData(['profile', user.id], profile);
      void client.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        update.reset();
        const result = updateProfileSchema.safeParse({ username, avatar });

        if (!result.success) {
          setValidation('Le pseudo doit contenir 3 à 24 lettres, chiffres, _ ou -.');
          return;
        }

        setValidation('');
        update.mutate(result.data);
      }}
    >
      <div className="space-y-1">
        <label htmlFor="profile-username" className="title text-xs">
          PSEUDO
        </label>
        <Input id="profile-username" name="username" autoComplete="username" maxLength={24} value={username} onChange={(event) => setUsername(event.target.value)} disabled={update.isPending} />
      </div>
      <AvatarPicker value={avatar ?? user.avatar} onChange={setAvatar} disabled={update.isPending} />
      {validation && (
        <p role="alert" className="text-sm font-bold text-rose-800">
          {validation}
        </p>
      )}
      <FormMessage error={update.error} message={update.isSuccess ? 'Profil mis à jour !' : undefined} />
      <Button type="submit" variant="yellow" className="w-full" disabled={update.isPending}>
        {update.isPending ? 'ENREGISTREMENT…' : 'ENREGISTRER'}
      </Button>
    </form>
  );
}
