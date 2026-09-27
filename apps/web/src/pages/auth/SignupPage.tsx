import { signupSchema } from '@coachdesk/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router';
import { homeFor } from '../../components/RequireRole';
import { Button, Field, FormError, Input } from '../../components/ui';
import { applyFieldErrors } from '../../lib/api';
import { useMe, useSignup } from '../../lib/queries';
import { AuthLayout } from './AuthLayout';

export function SignupPage() {
  const me = useMe();
  const signup = useSignup();
  const navigate = useNavigate();
  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors } = form.formState;

  if (me.data && !signup.isPending) return <Navigate to={homeFor(me.data)} replace />;

  const onSubmit = form.handleSubmit((values) =>
    signup.mutate(values, {
      onSuccess: () => navigate('/app', { replace: true }),
      onError: (err) => applyFieldErrors(err, form.setError),
    }),
  );

  return (
    <AuthLayout
      title="Create your trainer account"
      subtitle="You start on the Starter plan (up to 10 clients). No payment: this is a portfolio project."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={signup.error && !Object.keys(errors).length ? signup.error.message : null} />
        <Field label="Your name" error={errors.name?.message}>
          {(a) => <Input {...a} autoComplete="name" {...form.register('name')} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(a) => <Input {...a} type="email" autoComplete="email" {...form.register('email')} />}
        </Field>
        <Field label="Password" error={errors.password?.message} hint="At least 8 characters.">
          {(a) => <Input {...a} type="password" autoComplete="new-password" {...form.register('password')} />}
        </Field>
        <Button type="submit" loading={signup.isPending} className="mt-2">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-accent underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
