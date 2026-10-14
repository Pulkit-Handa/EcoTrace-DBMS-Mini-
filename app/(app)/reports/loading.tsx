export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="skeleton h-3 w-44" />
        <div className="skeleton h-9 w-96 max-w-full" />
        <div className="skeleton h-3 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card p-5">
            <div className="skeleton h-3 w-24" />
            <div className="mt-5 skeleton h-8 w-28" />
            <div className="mt-3 skeleton h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="flex gap-2 border-b border-ink-100 p-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-9 w-32" />
          ))}
        </div>
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
