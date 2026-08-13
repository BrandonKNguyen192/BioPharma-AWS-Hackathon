export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-slate-900"
            />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-xl bg-slate-900" />
      </div>
    </main>
  );
}
