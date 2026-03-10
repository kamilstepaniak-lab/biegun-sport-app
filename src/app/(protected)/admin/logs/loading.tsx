export default function LogsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-24 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
