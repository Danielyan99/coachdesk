import { NavLink, Route, Routes, useNavigate } from 'react-router';
import { DemoBanner } from '../../components/DemoBanner';
import { Logo } from '../../components/Logo';
import { SkipLink } from '../../components/SkipLink';
import { Button, cx } from '../../components/ui';
import { useLogout, useMe } from '../../lib/queries';
import { TodayPage } from './TodayPage';
import { WeekPage } from './WeekPage';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition',
    isActive ? 'text-accent' : 'text-ink-muted hover:text-ink',
  );

/** The client app: one column, big tap targets, a bottom tab bar like a phone app. */
export function ClientHomePage() {
  const { data: me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh pb-20">
      <SkipLink />
      {me?.demo && <DemoBanner role="client" />}
      <header className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <Logo to="/me" />
        <Button
          variant="ghost"
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
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-lg px-4 pb-6 outline-none">
        <Routes>
          <Route index element={<TodayPage />} />
          <Route path="week" element={<WeekPage />} />
        </Routes>
      </main>

      <nav
        aria-label="Client"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto flex max-w-lg">
          <NavLink to="/me" end className={tabClass}>
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Today
          </NavLink>
          <NavLink to="/me/week" className={tabClass}>
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
              <rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Week
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
