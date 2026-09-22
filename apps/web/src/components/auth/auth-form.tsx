'use client';
import { loginSchema, registerSchema } from '@ygo/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useLogin, useRegister } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

type Errors = Partial<Record<'email' | 'username' | 'password' | 'form', string>>;
type Issue = { path: PropertyKey[]; code: string };

/** Formulaire login/inscription — validé avec les MÊMES schémas zod que l'API. */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const register = useRegister();
  const mutation = mode === 'login' ? login : register;
  const [errors, setErrors] = useState<Errors>({});
  const t = useTranslations('auth');

  // Messages zod du schéma partagé → textes traduits, par champ
  function issueMessage(issue: Issue): string {
    const field = String(issue.path[0]);
    if (field === 'email') return t('errors.email');
    if (field === 'username') {
      return issue.code === 'invalid_format'
        ? t('errors.usernameChars')
        : t('errors.usernameLength');
    }
    if (issue.code === 'too_big') return t('errors.passwordMax');
    return mode === 'login' ? t('errors.passwordRequired') : t('errors.passwordLength');
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (mode === 'login' ? loginSchema : registerSchema).safeParse(raw);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), issueMessage(i)]),
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
      <h1 className="text-xl font-semibold tracking-tight">{t(`${mode}.title`)}</h1>
      <Field label={t('fields.email')} error={errors.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      {mode === 'register' && (
        <Field label={t('fields.username')} error={errors.username}>
          <Input name="username" autoComplete="username" required />
        </Field>
      )}
      <Field
        label={t('fields.password')}
        error={errors.password}
        hint={mode === 'register' ? t('fields.passwordHint') : undefined}
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
        {t(`${mode}.submit`)}
      </Button>
      <p className="text-center text-sm text-fg-muted">
        {t.rich(`${mode}.switch`, {
          link: (chunks) => (
            <Link
              href={mode === 'login' ? '/register' : '/login'}
              className="text-accent hover:underline"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}
