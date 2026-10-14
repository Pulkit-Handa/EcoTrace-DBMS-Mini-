export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="skeleton h-3 w-52" />
        <div className="skeleton h-9 w-80" />
        <div className="flex gap-2">
          <div className="skeleton h-6 w-36" />
          <div className="skeleton h-6 w-40" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card p-5">
            <div className="skeleton h-3 w-24" />
            <div className="mt-5 skeleton h-8 w-32" />
            <div className="mt-3 skeleton h-3 w-40" />
            <div className="mt-5 skeleton h-1.5 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="card xl:col-span-8">
          <div className="border-b border-ink-100 px-5 py-5">
            <div className="skeleton h-4 w-52" />
            <div className="mt-2 skeleton h-3 w-80" />
          </div>
          <div className="skeleton m-5 h-[300px]" />
        </div>
        <div className="card xl:col-span-4">
          <div className="border-b border-ink-100 px-5 py-5">
            <div className="skeleton h-4 w-28" />
          </div>
          <div className="space-y-5 p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index}>
                <div className="skeleton h-3 w-full" />
                <div className="mt-3 skeleton h-1.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
