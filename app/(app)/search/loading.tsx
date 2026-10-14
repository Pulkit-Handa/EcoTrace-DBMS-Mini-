export default function SearchLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="skeleton h-3 w-56" />
        <div className="skeleton h-9 w-72" />
        <div className="skeleton h-3 w-full max-w-2xl" />
        <div className="flex gap-2">
          <div className="skeleton h-6 w-64" />
          <div className="skeleton h-6 w-48" />
        </div>
      </div>
      <div className="card">
        <div className="p-5">
          <div className="skeleton h-10 w-64" />
          <div className="mt-4 skeleton h-12 w-full" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-6 w-24" />
            ))}
          </div>
        </div>
        <div className="grid gap-3 border-t border-ink-100 p-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-ink-100 p-4">
              <div className="skeleton h-9 w-9 rounded-xl" />
              <div className="mt-4 space-y-2">
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-5/6" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
