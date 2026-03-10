export default function ParentCalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-36 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-4 w-56 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="h-80 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  );
}
