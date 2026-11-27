// Clean React/TSX counterpart (tokenized, semantic, accessible)
export function CleanHero({ onSelectPlan }: { onSelectPlan: () => void }) {
  return (
    <section className="bg-[var(--color-surface)] p-6 rounded-md">
      <h1>Track invoice approvals in under two minutes</h1>
      <button
        type="button"
        onClick={onSelectPlan}
        className="transition-colors motion-reduce:transition-none focus-visible:outline-2"
      >
        Compare Team Plans
      </button>
    </section>
  );
}
