import { Star, MessageSquare } from 'lucide-react';

const recentReviews = [
  {
    text: '"Amazing rooftop experience! The view was stunning and service impeccable."',
    source: 'Google Maps',
    time: '2 hours ago',
  },
  {
    text: '"Great cocktails and atmosphere. Will definitely come back!"',
    source: 'TripAdvisor',
    time: '5 hours ago',
  },
];

export function ReviewsWidget() {
  const rating = 4.8;
  const reviewCount = '1.2k';
  const sentiment = 85;

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card h-full">
      <h3 className="text-lg font-semibold text-foreground mb-4">Service & Reviews</h3>

      <div className="flex items-center gap-4 mb-6">
        {/* Rating */}
        <div className="text-4xl font-bold text-foreground">{rating}</div>

        {/* Stars */}
        <div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= Math.floor(rating)
                    ? 'fill-warning text-warning'
                    : star - 0.5 <= rating
                    ? 'fill-warning/50 text-warning'
                    : 'text-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{reviewCount} reviews</p>
        </div>

        {/* Sentiment */}
        <div className="ml-auto">
          <div className="relative h-12 w-12">
            <svg className="h-12 w-12 -rotate-90 transform">
              <circle
                cx="24"
                cy="24"
                r="20"
                className="stroke-border"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                className="stroke-success"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 2 * Math.PI * 20,
                  strokeDashoffset: 2 * Math.PI * 20 * (1 - sentiment / 100),
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-success">{sentiment}%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">Sentiment</p>
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="space-y-4">
        {recentReviews.map((review, index) => (
          <div key={index} className="border-t border-border pt-4">
            <p className="text-sm text-foreground/80 italic">{review.text}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>{review.source}</span>
              <span>·</span>
              <span>{review.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
