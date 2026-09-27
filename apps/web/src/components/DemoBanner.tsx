import { Link } from 'react-router';

/** Shown on every page of a demo sandbox, so a visitor knows the data is theirs, private and temporary. */
export function DemoBanner({ role }: { role: 'trainer' | 'client' }) {
  return (
    <div className="bg-ink px-4 py-2 text-center text-xs text-white/90 sm:text-sm">
      Demo {role === 'trainer' ? 'trainer' : 'client'} account: your own private copy, deleted after 24 hours.{' '}
      <Link to="/" className="font-semibold text-white underline underline-offset-2">
        Back to the homepage
      </Link>
    </div>
  );
}
