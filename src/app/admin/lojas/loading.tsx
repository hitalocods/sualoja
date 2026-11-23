export default function AdminLojasLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="admin-skeleton h-7 w-44 rounded-xl" />
        <div className="admin-skeleton h-4 w-72 rounded-lg" />
      </div>

      <div className="admin-surface rounded-2xl p-4">
        <div className="admin-skeleton h-11 w-full rounded-2xl" />
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="admin-skeleton h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>

      <div className="admin-surface space-y-3 rounded-2xl p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="admin-skeleton h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
