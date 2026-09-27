import { Link } from 'react-router';
import { buttonClass } from '../components/ui';

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page doesn't exist</h1>
      <Link to="/" className={buttonClass('secondary')}>
        Go to the homepage
      </Link>
    </main>
  );
}
