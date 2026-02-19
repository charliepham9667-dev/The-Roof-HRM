// Supabase Edge Function: sync-google-reviews
// Fetches Google Reviews from Business Profile API and stores them

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GoogleReview {
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

function starRatingToNumber(rating: string): number {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return map[rating] || 0;
}

async function refreshAccessToken(supabase: any, clientId: string, clientSecret: string): Promise<string> {
  // Get stored refresh token
  const { data: tokenData } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "google_refresh_token")
    .single();

  if (!tokenData?.value) {
    throw new Error("No refresh token found. Please authorize Google first.");
  }

  // Refresh the access token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenData.value,
      grant_type: "refresh_token",
    }),
  });

  const tokens = await response.json();

  if (tokens.error) {
    throw new Error(`Token refresh error: ${tokens.error_description || tokens.error}`);
  }

  // Update stored access token
  await supabase.from("app_settings").upsert({
    key: "google_access_token",
    value: tokens.access_token,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });

  return tokens.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get or refresh access token
    const accessToken = await refreshAccessToken(supabase, clientId, clientSecret);

    // Step 1: Get accounts
    const accountsResponse = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const accountsData = await accountsResponse.json();
    
    if (!accountsData.accounts || accountsData.accounts.length === 0) {
      throw new Error("No Google Business accounts found");
    }

    const accountId = accountsData.accounts[0].name; // e.g., "accounts/123456"

    // Step 2: Get locations for this account
    const locationsResponse = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const locationsData = await locationsResponse.json();
    
    if (!locationsData.locations || locationsData.locations.length === 0) {
      throw new Error("No business locations found");
    }

    // Find "The Roof" location or use first one
    const location = locationsData.locations.find(
      (loc: any) => loc.title?.toLowerCase().includes("roof")
    ) || locationsData.locations[0];

    const locationName = location.name; // e.g., "locations/123456"

    // Step 3: Get reviews for this location
    const reviewsResponse = await fetch(
      `https://mybusiness.googleapis.com/v4/${accountId}/${locationName}/reviews`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const reviewsData = await reviewsResponse.json();
    const reviews: GoogleReview[] = reviewsData.reviews || [];

    // Calculate aggregate stats
    let totalRating = 0;
    let reviewCount = 0;

    // Store reviews in database
    for (const review of reviews) {
      const rating = starRatingToNumber(review.starRating);
      totalRating += rating;
      reviewCount++;

      await supabase.from("reviews").upsert({
        id: review.reviewId,
        source: "google",
        author_name: review.reviewer.displayName,
        rating: rating,
        comment: review.comment || null,
        published_at: review.createTime,
        metadata: {
          profilePhotoUrl: review.reviewer.profilePhotoUrl,
          reviewReply: review.reviewReply,
        },
      }, { onConflict: "id" });
    }

    const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;

    // Update today's metrics with Google review data
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("daily_metrics").upsert({
      date: today,
      google_rating: Math.round(averageRating * 10) / 10,
      google_review_count: reviewCount,
    }, { onConflict: "date" });

    // Also store the aggregate in app_settings for quick access
    await supabase.from("app_settings").upsert([
      { key: "google_rating", value: String(averageRating.toFixed(1)), updated_at: new Date().toISOString() },
      { key: "google_review_count", value: String(reviewCount), updated_at: new Date().toISOString() },
    ], { onConflict: "key" });

    return new Response(
      JSON.stringify({
        success: true,
        reviewCount,
        averageRating: Math.round(averageRating * 10) / 10,
        newReviews: reviews.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
