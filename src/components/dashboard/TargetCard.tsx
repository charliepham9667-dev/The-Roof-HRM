interface TargetCardProps {
  percentage: number;
  status: string;
}

export function TargetCard({ percentage, status }: TargetCardProps) {
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            TARGET MET
          </p>
          <div className="mt-3 flex items-center gap-4">
            {/* Circular Progress */}
            <div className="relative h-16 w-16">
              <svg className="h-16 w-16 -rotate-90 transform">
                <circle
                  cx="32"
                  cy="32"
                  r="36"
                  className="stroke-border"
                  strokeWidth="6"
                  fill="none"
                  style={{ transform: 'scale(0.89)', transformOrigin: 'center' }}
                />
                <circle
                  cx="32"
                  cy="32"
                  r="36"
                  className="stroke-primary"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: strokeDashoffset,
                    transform: 'scale(0.89)',
                    transformOrigin: 'center',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-foreground">{percentage}%</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{status}</p>
            </div>
          </div>
        </div>
        <div className="rounded-full bg-primary/20 p-1">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
