export default function DashboardLoading() {
  return (
    <main className="ct-app-canvas">
      <div className="ct-app-shell">
        <aside className="ct-nav-rail" />
        <section className="ct-workspace">
          <div className="ct-topbar" />
          <div className="ct-workspace-content">
            <div className="ct-dashboard-grid">
              {Array.from({ length: 2 }).map((_, index) => <div key={index} className="ct-metric-large animate-pulse bg-[var(--ct-surface-soft)]" />)}
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="ct-metric-small animate-pulse bg-[var(--ct-surface-soft)]" />)}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
