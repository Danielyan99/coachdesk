import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { buttonClass } from '../components/ui';

// Placeholder until Phase 7 (full landing page with demo buttons).
export function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <Logo />
      <h1 className="text-4xl font-bold tracking-tight">Coachdesk</h1>
      <p className="text-lg text-ink-muted">
        Weekly workout and meal plans for your clients, and one screen that shows who is on track.
      </p>
      <div className="flex gap-3">
        <Link to="/signup" className={buttonClass()}>
          Create a trainer account
        </Link>
        <Link to="/login" className={buttonClass('secondary')}>
          Log in
        </Link>
      </div>
    </main>
  );
}
