export default function OwuLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-56 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  );
}
