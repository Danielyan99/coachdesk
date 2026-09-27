import type { AuthUser, Role } from '@coachdesk/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useMe } from '../lib/queries';
import { ErrorState } from './ui';
import { FullPageLoader } from './FullPageLoader';

export function homeFor(user: AuthUser): string {
  return user.role === 'trainer' ? '/app' : '/me';
}

/** Shows the page only to a logged-in user with this role; others go to login or to their own home. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <FullPageLoader />;
  if (me.isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </div>
    );
  }
  if (!me.data) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (me.data.role !== role) return <Navigate to={homeFor(me.data)} replace />;
  return children;
}
