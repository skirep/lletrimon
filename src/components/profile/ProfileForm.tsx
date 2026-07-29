import { useState } from 'react';
import styles from './ProfileForm.module.css';
import { Avatar, Button } from '../common';
import { AVATARS } from '../../models';
import { generateId } from '../../utils';
import type { Profile } from '../../models';

interface ProfileFormProps {
  onSave: (profile: Profile) => void;
  onCancel: () => void;
  initial?: Profile;
}

export function ProfileForm({ onSave, onCancel, initial }: ProfileFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? AVATARS[0]);
  const [isAdmin, setIsAdmin] = useState(initial?.isAdmin ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const profile: Profile = {
      id: initial?.id ?? generateId(),
      name: name.trim(),
      avatar,
      isAdmin,
      createdAt: initial?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    onSave(profile);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>
        {initial ? 'Editar perfil' : 'Nou perfil'}
      </h2>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="profile-name">Nom</label>
        <input
          id="profile-name"
          className={styles.input}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Escriu el teu nom..."
          maxLength={30}
          autoFocus
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Tria el teu avatar</label>
        <div className={styles.avatarGrid}>
          {AVATARS.map((av) => (
            <button
              key={av}
              type="button"
              className={`${styles.avatarBtn} ${avatar === av ? styles.avatarSelected : ''}`}
              onClick={() => setAvatar(av)}
            >
              <Avatar avatarId={av} size="md" />
            </button>
          ))}
        </div>
      </div>

      <label className={styles.adminToggle}>
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
        />
        <span>👑 Perfil administrador</span>
      </label>

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel·lar
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {initial ? 'Guardar' : 'Crear perfil'}
        </Button>
      </div>
    </form>
  );
}
