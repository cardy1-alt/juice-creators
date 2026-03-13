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

  // Seed test businesses
  const { data: businesses, error: bizError } = await supabase
    .from("businesses")
    .upsert(
      [
        { name: "Sunrise Café", slug: "sunrise-cafe", owner_email: "business1@test.com", approved: true },
        { name: "Urban Juice Bar", slug: "urban-juice-bar", owner_email: "business2@test.com", approved: true },
        { name: "Fresh Smoothies Co", slug: "fresh-smoothies", owner_email: "business3@test.com", approved: false },
      ],
      { onConflict: "slug" },
    )
    .select();

  if (bizError) {
    return new Response(JSON.stringify({ error: "Failed to seed businesses", details: bizError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Seed test creators
  const { data: creators, error: creatorError } = await supabase
    .from("creators")
    .upsert(
      [
        { name: "Sophie Chen", instagram_handle: "@sophie.creates", code: "SOPHIE01", email: "creator1@test.com", approved: true },
        { name: "Marcus Rivera", instagram_handle: "@marcus.films", code: "MARCUS01", email: "creator2@test.com", approved: true },
        { name: "Ava Kim", instagram_handle: "@ava.reels", code: "AVA01", email: "creator3@test.com", approved: false },
      ],
      { onConflict: "email" },
    )
    .select();

  if (creatorError) {
    return new Response(JSON.stringify({ error: "Failed to seed creators", details: creatorError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Seed test offers (linked to first business)
  const businessId = businesses?.[0]?.id;
  let offers = null;
  if (businessId) {
    const { data: offerData, error: offerError } = await supabase
      .from("offers")
      .upsert(
        [
          { business_id: businessId, description: "Free smoothie in exchange for a 30-second reel", monthly_cap: 4, is_live: true },
          { business_id: businessId, description: "Buy one get one free juice — film your visit!", monthly_cap: 2, is_live: true },
        ],
        { onConflict: "id", ignoreDuplicates: true },
      )
      .select();

    if (!offerError) offers = offerData;
  }

  return new Response(
    JSON.stringify({
      message: "Test data seeded successfully",
      businesses: businesses?.length ?? 0,
      creators: creators?.length ?? 0,
      offers: offers?.length ?? 0,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
