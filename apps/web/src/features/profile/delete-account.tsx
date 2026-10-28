import { deleteAccountSchema } from '@shifu/shared';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { apiFetch } from '@/lib/api-client';

export function DeleteAccount() {
  const { token, clearSession } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState('');
  const [validation, setValidation] = useState('');
  const remove = useMutation({
    mutationFn: (body: { password: string }) => apiFetch<void>('/api/users/me', { method: 'DELETE', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      clearSession();
      window.location.replace('/');
    },
  });

  const close = () => {
    if (remove.isPending) {
      return;
    }

    dialog.current?.close();
    setPassword('');
    setValidation('');
    remove.reset();
  };

  return (
    <section className="arcade-card space-y-3 bg-white p-5">
      <h2 className="title text-lg">SUPPRIMER MON COMPTE</h2>
      <p className="text-sm font-bold">Cette action est définitive. Ton profil et tes sessions seront supprimés.</p>
      <Button variant="destructive" onClick={() => dialog.current?.showModal()}>
        SUPPRIMER MON COMPTE
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        className="arcade-card m-auto w-[calc(100%-2rem)] max-w-md bg-white p-5 sm:p-6"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <h2 id="delete-account-title" className="title text-xl">
          SUPPRIMER DÉFINITIVEMENT TON COMPTE ?
        </h2>
        <p id="delete-account-description" className="mt-3 text-sm font-bold">
          Tu disparaîtras du classement et seras déconnecté de tous tes appareils. Tes anciens matchs resteront visibles pour tes adversaires sous la mention « Compte supprimé ». Si une partie est en cours, termine-la avant de supprimer ton compte.
        </p>
        <form
          className="mt-5 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();

            if (remove.isPending) {
              return;
            }

            const result = deleteAccountSchema.safeParse({ password });

            if (!result.success) {
              setValidation('Renseigne ton mot de passe actuel.');
              return;
            }

            setValidation('');
            remove.mutate(result.data);
          }}
        >
          <div className="space-y-2">
            <label htmlFor="delete-account-password" className="title text-xs">
              TON MOT DE PASSE ACTUEL
            </label>
            <Input id="delete-account-password" name="password" type="password" autoComplete="current-password" value={password} maxLength={72} required disabled={remove.isPending} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {validation && (
            <p role="alert" className="text-sm font-bold text-rose-800">
              {validation}
            </p>
          )}
          <FormMessage error={remove.error} />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="flex-1" disabled={remove.isPending} onClick={close}>
              ANNULER
            </Button>
            <Button type="submit" variant="destructive" className="flex-1" disabled={remove.isPending}>
              {remove.isPending ? 'SUPPRESSION…' : 'SUPPRIMER DÉFINITIVEMENT'}
            </Button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
