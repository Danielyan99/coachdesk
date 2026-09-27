/** First thing a keyboard user reaches: jumps past the header and navigation. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
    >
      Skip to content
    </a>
  );
}
