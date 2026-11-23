export default function AdminDashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="admin-skeleton h-7 w-56 rounded-xl" />
          <div className="admin-skeleton h-4 w-72 rounded-lg" />
        </div>
        <div className="admin-skeleton h-10 w-36 rounded-2xl" />
      </div>

      {/* 4 KPI Skeletons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="admin-surface rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="admin-skeleton h-3.5 w-28 rounded-lg" />
              <div className="admin-skeleton h-6 w-14 rounded-full" />
            </div>
            <div className="admin-skeleton mt-4 h-8 w-32 rounded-xl" />
            <div className="admin-skeleton mt-4 h-12 w-full rounded-xl" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="admin-surface rounded-2xl p-5 xl:col-span-8">
          <div className="admin-skeleton h-5 w-48 rounded-lg" />
          <div className="admin-skeleton mt-5 h-[280px] w-full rounded-2xl" />
        </div>
        <div className="admin-surface rounded-2xl p-5 xl:col-span-4">
          <div className="admin-skeleton h-5 w-36 rounded-lg" />
          <div className="admin-skeleton mt-5 h-[280px] w-full rounded-2xl" />
        </div>
      </div>

      {/* Bottom Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="admin-surface rounded-2xl p-5 lg:col-span-6">
          <div className="admin-skeleton h-5 w-40 rounded-lg" />
          <div className="admin-skeleton mt-4 h-44 w-full rounded-2xl" />
        </div>
        <div className="admin-surface rounded-2xl p-5 lg:col-span-6">
          <div className="admin-skeleton h-5 w-40 rounded-lg" />
          <div className="admin-skeleton mt-4 h-44 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
