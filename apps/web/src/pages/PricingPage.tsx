import { TIERS, TIER_IDS } from '@coachdesk/shared';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';
import { useMe, useSwitchTier } from '../lib/queries';

// Minimal version; Phase 7 turns this into the full pricing page.
export function PricingPage() {
  const { data: me } = useMe();
  const switchTier = useSwitchTier();
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10">
      <Logo />
      <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
      {switchTier.error && <p className="text-sm text-behind">{switchTier.error.message}</p>}
      <ul className="grid gap-4 sm:grid-cols-3">
        {TIER_IDS.map((id) => (
          <li key={id} className="card flex flex-col gap-2 p-5">
            <p className="font-semibold">{TIERS[id].name}</p>
            <p className="text-2xl font-bold">${TIERS[id].priceUsd}/mo</p>
            <p className="text-sm text-ink-muted">
              {Number.isFinite(TIERS[id].maxClients) ? `Up to ${TIERS[id].maxClients} clients` : 'Unlimited clients'}
            </p>
            {me?.role === 'trainer' &&
              (me.tier === id ? (
                <p className="text-sm font-medium text-accent">Your plan</p>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => switchTier.mutate(id)}>
                  Switch (demo, no payment)
                </Button>
              ))}
          </li>
        ))}
      </ul>
      {me?.role === 'trainer' && (
        <Link to="/app" className="text-sm font-medium text-accent">
          ← Back to clients
        </Link>
      )}
    </main>
  );
}
