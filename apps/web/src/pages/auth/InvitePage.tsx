import { acceptInviteSchema, type InvitePreviewDto } from '@coachdesk/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Field, FormError, Input, Skeleton } from '../../components/ui';
import { api, applyFieldErrors } from '../../lib/api';
import { useAcceptInvite } from '../../lib/queries';
import { AuthLayout } from './AuthLayout';

/** The client opens the link their trainer sent, picks an email and password, and lands on Today. */
export function InvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<InvitePreviewDto>(`/auth/invite/${token}`),
    retry: false,
  });
  const accept = useAcceptInvite(token);
  const form = useForm({ resolver: zodResolver(acceptInviteSchema), defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;

  if (preview.isPending) {
    return (
      <AuthLayout title="Opening your invite">
        <Skeleton className="h-40" />
      </AuthLayout>
    );
  }

  if (preview.isError) {
    return (
      <AuthLayout title="This link doesn't work" subtitle={preview.error.message}>
        <p className="text-sm text-ink-muted">
          Already set up your login?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Log in here
          </Link>
          .
        </p>
      </AuthLayout>
    );
  }

  const onSubmit = form.handleSubmit((values) =>
    accept.mutate(values, {
      onSuccess: () => navigate('/me', { replace: true }),
      onError: (err) => applyFieldErrors(err, form.setError),
    }),
  );

  return (
    <AuthLayout
      title={`Hi ${preview.data.clientName.split(' ')[0]}!`}
      subtitle={`${preview.data.trainerName} invited you to see your plan on Coachdesk. Choose how you'll log in.`}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={accept.error && !Object.keys(errors).length ? accept.error.message : null} />
        <Field label="Your email" error={errors.email?.message}>
          {(a) => <Input {...a} type="email" autoComplete="email" {...form.register('email')} />}
        </Field>
        <Field label="Choose a password" error={errors.password?.message} hint="At least 8 characters.">
          {(a) => <Input {...a} type="password" autoComplete="new-password" {...form.register('password')} />}
        </Field>
        <Button type="submit" loading={accept.isPending} className="mt-2">
          See my plan
        </Button>
      </form>
    </AuthLayout>
  );
}
