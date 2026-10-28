import { AVATARS } from '@shifu/shared';

export function AvatarPicker({ value, onChange, disabled = false }: { value: string; onChange: (avatar: (typeof AVATARS)[number]) => void; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="title mb-2 text-xs">TON AVATAR</legend>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {AVATARS.map((avatar, index) => (
          <label key={avatar} className="relative cursor-pointer">
            <input type="radio" name="avatar" value={avatar} checked={value === avatar} onChange={() => onChange(avatar)} className="peer sr-only" aria-label={['Pierre', 'Feuille', 'Ciseaux', 'Dragon', 'Renard', 'Panda', 'Alien', 'Kimono', 'Ramen', 'Éclair'][index]} />
            <span className="arcade-button flex min-h-12 items-center justify-center bg-white text-2xl peer-checked:bg-mint peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-disabled:opacity-50">{avatar}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
