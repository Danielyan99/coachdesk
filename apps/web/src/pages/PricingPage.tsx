import { type Tier, TIER_IDS, TIERS } from '@coachdesk/shared';
import { Link } from 'react-router';
import { DemoButtons } from '../components/DemoButtons';
import { PublicFooter, PublicHeader } from '../components/PublicHeader';
import { Button, cx, FormError } from '../components/ui';
import { useMe, useSwitchTier } from '../lib/queries';

const INCLUDED = [
  'Unlimited templates and plans',
  'Client app with daily checklist',
  'Invite links for WhatsApp or email',
  'On-track dashboard',
];

export function PricingPage() {
  const { data: me } = useMe();
  const switchTier = useSwitchTier();
  const isTrainer = me?.role === 'trainer';

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight">Simple, flat pricing</h1>
          <p className="mt-3 text-lg text-ink-muted">
            Pay for the size of your business, not per client. Every plan has every feature.
          </p>
        </div>

        <p className="mt-6 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm text-ink">
          This is a portfolio project: switching plans is instant and nothing is charged.
        </p>
        <FormError message={switchTier.error?.message} />

        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {TIER_IDS.map((id) => (
            <TierCard
              key={id}
              id={id}
              current={isTrainer && me.tier === id}
              canSwitch={isTrainer}
              switching={switchTier.isPending && switchTier.variables === id}
              onSwitch={() => switchTier.mutate(id)}
            />
          ))}
        </ul>

        <div className="mt-12">
          {isTrainer ? (
            <Link to="/app" className="font-medium text-accent hover:underline">
              ← Back to your clients
            </Link>
          ) : (
            <div className="card p-6 sm:p-8">
              <h2 className="text-xl font-semibold">Try it first</h2>
              <p className="mt-1 text-ink-muted">A full demo account with sample clients, ready in a few seconds.</p>
              <DemoButtons className="mt-5" />
            </div>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

function TierCard({
  id,
  current,
  canSwitch,
  switching,
  onSwitch,
}: {
  id: Tier;
  current: boolean;
  canSwitch: boolean;
  switching: boolean;
  onSwitch: () => void;
}) {
  const tier = TIERS[id];
  const popular = id === 'pro';
  return (
    <li className={cx('card relative flex flex-col p-6', popular && 'border-accent ring-1 ring-accent')}>
      {popular && (
        <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
          Most popular
        </span>
      )}
      <h2 className="text-lg font-semibold">{tier.name}</h2>
      <p className="mt-3">
        <span className="text-4xl font-bold tracking-tight">${tier.priceUsd}</span>
        <span className="text-ink-muted"> / month</span>
      </p>
      <p className="mt-1 font-medium">
        {Number.isFinite(tier.maxClients) ? `Up to ${tier.maxClients} clients` : 'Unlimited clients'}
      </p>
      <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-ink-muted">
        {INCLUDED.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-on-track">
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {current ? (
          <p className="flex min-h-11 items-center justify-center rounded-xl bg-accent-soft text-sm font-semibold text-accent">
            Your current plan
          </p>
        ) : canSwitch ? (
          <Button variant={popular ? 'primary' : 'secondary'} className="w-full" loading={switching} onClick={onSwitch}>
            Switch to {tier.name}
          </Button>
        ) : (
          <Link
            to="/signup"
            className={cx(
              'flex min-h-11 items-center justify-center rounded-xl text-sm font-medium',
              popular
                ? 'bg-accent text-white hover:bg-accent-strong'
                : 'border border-line bg-card hover:border-ink-faint',
            )}
          >
            Create an account
          </Link>
        )}
      </div>
    </li>
  );
}
