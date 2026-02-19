import { Star, MessageSquare, Loader2 } from 'lucide-react';
import { useGoogleReviews } from '../../hooks/useDashboardData';

export interface ServiceReviewsProps {
  /** If true, renders content only without card wrapper */
  noContainer?: boolean;
}

export function ServiceReviews({ noContainer = false }: ServiceReviewsProps) {
  const { data, isLoading, error } = useGoogleReviews();

  if (isLoading) {
    if (noContainer) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[200px] md:min-h-[256px] w-full shadow-card flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    if (noContainer) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <p className="text-muted-foreground">Failed to load reviews</p>
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[200px] md:min-h-[256px] w-full shadow-card flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load reviews</p>
      </div>
    );
  }

  const rating = data?.rating || 0;
  const reviewCount = data?.reviewCount || 0;
  // Convert rating to sentiment percentage (5 stars = 100%)
  const sentiment = rating > 0 ? Math.round((rating / 5) * 100) : 0;

  const content = (
    <>
      {/* Meta row (no title; WidgetCard provides it) */}
      <div className="flex items-center justify-end">
        <span className="text-[10px] md:text-xs text-muted-foreground">From sheet sync</span>
      </div>

      {/* Rating Row */}
      <div className="flex items-center gap-3 md:gap-4">
        <span className="text-3xl md:text-4xl font-bold text-foreground">{rating || '—'}</span>
        <div className="flex flex-col">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-3 w-3 md:h-4 md:w-4 ${
                  star <= Math.floor(rating)
                    ? 'fill-warning text-warning'
                    : star <= rating
                    ? 'fill-warning/50 text-warning'
                    : 'text-muted'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] md:text-xs text-muted-foreground">{reviewCount.toLocaleString()} reviews</span>
        </div>
        {/* Sentiment Circle */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative h-10 w-10">
            <svg className="h-10 w-10 -rotate-90 transform">
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-border"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-success"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${(sentiment / 100) * 100.5} 100.5`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">
              {sentiment}%
            </span>
          </div>
          <span className="hidden md:inline text-xs text-muted-foreground">Rating</span>
        </div>
      </div>

      {/* Info - condensed for bottom row */}
      <div className="mt-3 text-muted-foreground font-thin">
        {rating > 0 ? (
          <p className="text-sm">
            <span className="text-foreground font-semibold">{rating} out of 5</span> based on {reviewCount.toLocaleString()} reviews
          </p>
        ) : (
          <div>
            <MessageSquare className="h-6 w-6 mb-1 mx-auto" />
            <p className="text-xs">No review data yet</p>
          </div>
        )}
      </div>
    </>
  );

  if (noContainer) {
    return <div className="h-full min-h-0 w-full flex flex-col space-y-3">{content}</div>;
  }

  return (
    <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[200px] md:min-h-[256px] w-full shadow-card flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base md:text-lg font-semibold text-foreground">Google Reviews</h3>
        <span className="text-[10px] md:text-xs text-muted-foreground">From sheet sync</span>
      </div>
      {content}
    </div>
  );
}
