export default function TripAddLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-44 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-4 w-56 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-10 w-32 bg-gray-200 rounded-xl animate-pulse" />
    </div>
  );
}
