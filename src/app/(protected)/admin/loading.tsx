import { Rocket } from 'lucide-react';

export default function AdminLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 select-none">
      <div className="relative">
        {/* Outer pulsing ring */}
        <span className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-60" />
        {/* Inner circle */}
        <span className="relative flex items-center justify-center h-20 w-20 rounded-full bg-blue-50 border border-blue-100">
          <Rocket className="h-9 w-9 text-blue-500 -rotate-45 animate-bounce" />
        </span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-gray-700 font-semibold text-base">Już ładuję…</p>
        <p className="text-gray-400 text-sm">Proszę chwilę poczekać</p>
      </div>

      {/* Animated dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-blue-400"
            style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}
