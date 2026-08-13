export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[var(--ct-bg)] px-6 py-10 transition-colors">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="ct-card h-28 animate-pulse rounded-xl"
            />
          ))}
        </div>
        <div className="ct-card h-40 animate-pulse rounded-xl" />
      </div>
    </main>
  );
}
