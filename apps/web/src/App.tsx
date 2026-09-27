import { Route, Routes } from 'react-router';

function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-4xl font-bold tracking-tight">Coachdesk</h1>
      <p className="text-lg text-ink-muted">
        Weekly workout and meal plans for your clients, and one screen that shows who is on track.
      </p>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
