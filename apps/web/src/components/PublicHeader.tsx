import { Link } from 'react-router';
import { useMe } from '../lib/queries';
import { Logo } from './Logo';
import { homeFor } from './RequireRole';
import { buttonClass } from './ui';

export function PublicHeader() {
  const { data: me } = useMe();
  return (
    <header className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
      <Logo />
      <nav aria-label="Main" className="ml-auto flex items-center gap-1 sm:gap-2">
        <Link to="/pricing" className={buttonClass('ghost', 'sm')}>
          Pricing
        </Link>
        {me ? (
          <Link to={homeFor(me)} className={buttonClass('secondary', 'sm')}>
            Open the app
          </Link>
        ) : (
          <>
            <Link to="/login" className={buttonClass('ghost', 'sm')}>
              Log in
            </Link>
            <Link to="/signup" className={`${buttonClass('secondary', 'sm')} hidden sm:inline-flex`}>
              Create account
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Coachdesk is a portfolio project by Narek Danielyan. React, NestJS and MongoDB.</p>
        <a
          href="https://github.com/Danielyan99/coachdesk"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-ink hover:text-accent"
        >
          Source code on GitHub
        </a>
      </div>
    </footer>
  );
}
