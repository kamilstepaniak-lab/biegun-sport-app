export default function ProfileLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-gray-100 rounded animate-pulse" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border p-6 space-y-4">
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
