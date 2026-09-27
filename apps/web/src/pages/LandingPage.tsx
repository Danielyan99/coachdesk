import type { AdherenceStatus } from '@coachdesk/shared';
import { DemoButtons } from '../components/DemoButtons';
import { PublicFooter, PublicHeader } from '../components/PublicHeader';
import { StatusChip } from '../components/ui';

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <p className="text-sm font-semibold text-accent">For personal trainers</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Know which clients are on track. Every day.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-muted">
              Coachdesk turns your workout and meal plans into a simple daily checklist for each client, and shows you
              who is falling behind before they quit.
            </p>
            <DemoButtons className="mt-8" />
          </div>
          <ProductPreview />
        </section>

        <section aria-labelledby="features" className="border-t border-line bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="features" className="text-2xl font-semibold tracking-tight">
              Built for how trainers really work
            </h2>
            <ul className="mt-8 grid gap-8 md:grid-cols-3">
              <Feature title="Plans in minutes">
                Build a week of workouts and meals once, as a template. Assign it to a client and they get their own
                copy you can adjust, like swapping lunges for a bad knee.
              </Feature>
              <Feature title="A checklist clients actually use">
                Send a one-time link on WhatsApp. Clients open today's plan on their phone and tick things off with one
                tap. No app to install.
              </Feature>
              <Feature title="See who needs you">
                Every client gets a clear status from the last 7 days: on track, at risk or behind. The dashboard shows
                who needs a message first.
              </Feature>
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="card flex flex-col items-start gap-6 p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">See it with real data</h2>
              <p className="mt-2 max-w-lg text-ink-muted">
                The demo has 8 clients, 3 templates and two weeks of history. Change anything: it's your private copy.
              </p>
            </div>
            <DemoButtons />
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-ink-muted">{children}</p>
    </li>
  );
}

const PREVIEW_ROWS: { name: string; plan: string; status: AdherenceStatus; pct?: string }[] = [
  { name: 'Lena Müller', plan: 'Busy schedule', status: 'behind', pct: '21%' },
  { name: 'Sofia Rossi', plan: 'Fat loss (knee-friendly)', status: 'at-risk', pct: '64%' },
  { name: 'Nina Ivanova', plan: 'Beginner strength', status: 'no-data' },
  { name: 'Ana Petrosyan', plan: 'Beginner strength', status: 'on-track', pct: '94%' },
];

/** A small, static picture of the two sides of the app, drawn with the real components. */
function ProductPreview() {
  return (
    <div aria-hidden className="relative">
      <div className="card p-4 shadow-sm sm:p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Clients</p>
          <p className="text-xs text-ink-muted">8 of 30 clients · Pro plan</p>
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {PREVIEW_ROWS.map((r) => (
            <li key={r.name} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-ink-muted">{r.plan}</p>
              </div>
              <StatusChip status={r.status} detail={r.pct} />
            </li>
          ))}
        </ul>
      </div>
      <div className="card absolute -bottom-10 -left-4 hidden w-56 p-4 shadow-lg sm:block lg:-left-10">
        <p className="text-xs text-ink-muted">Today · Ana</p>
        <p className="mt-1 text-sm font-semibold">3 of 6 done</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
          <div className="h-full w-1/2 rounded-full bg-on-track" />
        </div>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {[
            ['Goblet squat', true],
            ['Push-up', true],
            ['Dumbbell row', false],
          ].map(([label, done]) => (
            <li key={String(label)} className="flex items-center gap-2">
              <span
                className={`flex size-4 items-center justify-center rounded ${done ? 'bg-on-track text-white' : 'border-2 border-ink-faint'}`}
              >
                {done && (
                  <svg viewBox="0 0 24 24" className="size-3">
                    <path
                      d="M6 12.5l4 4L18 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </span>
              <span className={done ? 'text-ink-muted line-through' : ''}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
