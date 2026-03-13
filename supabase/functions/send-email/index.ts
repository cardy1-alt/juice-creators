import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  type: "creator_approved" | "business_approved" | "reel_reminder" | "claim_expired" | "claim_redeemed";
  data?: Record<string, string>;
}

const templates: Record<string, { subject: string; body: (data?: Record<string, string>) => string }> = {
  creator_approved: {
    subject: "Welcome to Juice Creators!",
    body: () =>
      "Your creator account has been approved! You can now browse live offers from local businesses and start creating content.",
  },
  business_approved: {
    subject: "Your business is live on Juice Creators",
    body: (data) =>
      `Your business ${data?.business_name ?? ""} has been approved! You can now create offers and connect with local creators.`,
  },
  reel_reminder: {
    subject: "Reminder: Submit your reel",
    body: (data) =>
      `You redeemed an offer at ${data?.business_name ?? "a local business"} ${data?.hours_ago ?? "24"} hours ago. Please submit your reel within 48 hours to keep your claim active.`,
  },
  claim_expired: {
    subject: "Your claim has expired",
    body: () =>
      "Your offer claim has expired because a reel was not submitted within the 48-hour window. Don't worry — there are more offers available!",
  },
  claim_redeemed: {
    subject: "Offer redeemed successfully!",
    body: (data) =>
      `Great news! Your offer at ${data?.business_name ?? "a local business"} has been redeemed. Please submit your reel within 48 hours.`,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { to, type, data }: EmailRequest = await req.json();

  if (!to || !type) {
    return new Response(JSON.stringify({ error: "Missing required fields: to, type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const template = templates[type];
  if (!template) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Send email via Supabase Auth admin API (uses built-in email provider)
  const { error } = await supabase.auth.admin.inviteUserByEmail(to, {
    data: { email_subject: template.subject, email_body: template.body(data) },
  });

  // Log the email attempt as a notification regardless of send outcome
  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    user_type: "admin",
    message: `Email [${type}] sent to ${to}: ${template.subject}`,
    read: false,
  });

  if (error) {
    // Fall back to just logging — email provider may not be configured
    console.error("Email send failed:", error.message);
    return new Response(
      JSON.stringify({
        warning: "Email provider not configured. Notification logged instead.",
        subject: template.subject,
        body: template.body(data),
        notif_logged: !notifError,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ message: "Email sent successfully", to, type }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
