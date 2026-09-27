import { loginSchema } from '@coachdesk/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { homeFor } from '../../components/RequireRole';
import { Button, Field, FormError, Input } from '../../components/ui';
import { useLogin, useMe } from '../../lib/queries';
import { AuthLayout } from './AuthLayout';

/** Only follow same-site paths after login (never an absolute URL from the query string). */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function LoginPage() {
  const me = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;

  if (me.data && !login.isPending) return <Navigate to={next ?? homeFor(me.data)} replace />;

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, { onSuccess: (user) => navigate(next ?? homeFor(user), { replace: true }) }),
  );

  return (
    <AuthLayout title="Log in" subtitle="Trainers and clients use the same login.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={login.error?.message} />
        <Field label="Email" error={errors.email?.message}>
          {(a) => <Input {...a} type="email" autoComplete="email" {...form.register('email')} />}
        </Field>
        <Field label="Password" error={errors.password?.message}>
          {(a) => <Input {...a} type="password" autoComplete="current-password" {...form.register('password')} />}
        </Field>
        <Button type="submit" loading={login.isPending} className="mt-2">
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        New trainer?{' '}
        <Link to="/signup" className="font-medium text-accent underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
