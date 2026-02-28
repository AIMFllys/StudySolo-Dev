// Loading skeleton for the workspace workflow list page
export default function WorkspaceLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 h-7 w-32 rounded-md bg-muted animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 animate-pulse"
          >
            {/* Title */}
            <div className="h-5 w-3/4 rounded bg-muted" />
            {/* Description */}
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
            {/* Footer */}
            <div className="mt-auto flex items-center justify-between pt-2">
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
