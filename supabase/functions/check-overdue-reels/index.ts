import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago

  // Find redeemed claims with no reel submitted past the 48-hour window
  const { data: overdueClaims, error: fetchError } = await supabase
    .from("claims")
    .select("id, creator_id, offer_id, business_id, redeemed_at")
    .eq("status", "redeemed")
    .is("reel_url", null)
    .lt("redeemed_at", cutoff.toISOString());

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!overdueClaims || overdueClaims.length === 0) {
    return new Response(JSON.stringify({ message: "No overdue reels found", count: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Mark overdue claims as expired
  const overdueIds = overdueClaims.map((c) => c.id);
  const { error: updateError } = await supabase
    .from("claims")
    .update({ status: "expired" })
    .in("id", overdueIds);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create notifications for affected creators
  const notifications = overdueClaims.map((claim) => ({
    user_id: claim.creator_id,
    user_type: "creator",
    message: "Your claim expired because a reel was not submitted within 48 hours of redemption.",
    read: false,
  }));

  await supabase.from("notifications").insert(notifications);

  return new Response(
    JSON.stringify({ message: "Overdue reels processed", expired: overdueIds.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
