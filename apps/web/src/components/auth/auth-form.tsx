'use client';
import { loginSchema, registerSchema } from '@ygo/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useLogin, useRegister } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

type Errors = Partial<Record<'email' | 'username' | 'password' | 'form', string>>;

/** Formulaire login/inscription — validé avec les MÊMES schémas zod que l'API. */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const register = useRegister();
  const mutation = mode === 'login' ? login : register;
  const [errors, setErrors] = useState<Errors>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (mode === 'login' ? loginSchema : registerSchema).safeParse(raw);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
        ) as Errors,
      );
      return;
    }
    setErrors({});
    const onSuccess = () => {
      const next = params.get('next');
      router.replace(next?.startsWith('/') ? next : '/collection');
    };
    const onError = (err: Error) =>
      setErrors(
        err instanceof ApiError && err.issues
          ? (Object.fromEntries(err.issues.map((i) => [i.path, i.message])) as Errors)
          : { form: err.message },
      );
    if (mode === 'login') login.mutate(parsed.data as never, { onSuccess, onError });
    else register.mutate(parsed.data as never, { onSuccess, onError });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-bg-elevated p-6"
      noValidate
    >
      <h1 className="text-xl font-semibold tracking-tight">
        {mode === 'login' ? 'Content de te revoir' : 'Créer un compte'}
      </h1>
      <Field label="Email" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      {mode === 'register' && (
        <Field label="Pseudo" error={errors.username}>
          <Input name="username" autoComplete="username" required />
        </Field>
      )}
      <Field
        label="Mot de passe"
        error={errors.password}
        hint={mode === 'register' ? '10 caractères minimum' : undefined}
      >
        <Input
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
        />
      </Field>
      {errors.form && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{errors.form}</p>
      )}
      <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
        {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
      </Button>
      <p className="text-center text-sm text-fg-muted">
        {mode === 'login' ? (
          <>
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-accent hover:underline">
              Inscription
            </Link>
          </>
        ) : (
          <>
            Déjà inscrit ?{' '}
            <Link href="/login" className="text-accent hover:underline">
              Connexion
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
