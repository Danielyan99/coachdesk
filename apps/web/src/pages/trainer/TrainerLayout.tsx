import { TIERS } from '@coachdesk/shared';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { DemoBanner } from '../../components/DemoBanner';
import { Logo } from '../../components/Logo';
import { Button, cx } from '../../components/ui';
import { useLogout, useMe } from '../../lib/queries';

const navClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-ink/5 hover:text-ink',
  );

export function TrainerLayout() {
  const { data: me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh">
      {me?.demo && <DemoBanner role="trainer" />}
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Logo to="/app" />
          <nav aria-label="Main" className="order-last -mx-3 flex w-full gap-1 sm:order-none sm:mx-0 sm:w-auto">
            <NavLink to="/app" end className={navClass}>
              Clients
            </NavLink>
            <NavLink to="/app/templates" className={navClass}>
              Templates
            </NavLink>
            <NavLink to="/pricing" className={navClass}>
              Plan & pricing
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {me && (
              <span className="hidden text-right text-sm leading-tight sm:block">
                <span className="block font-medium">{me.name}</span>
                <span className="block text-xs text-ink-muted">{TIERS[me.tier ?? 'starter'].name} plan</span>
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              loading={logout.isPending}
              onClick={() => {
                // Leave the protected page first; clearing the session there would redirect to /login instead.
                navigate('/', { replace: true });
                logout.mutate();
              }}
            >
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
