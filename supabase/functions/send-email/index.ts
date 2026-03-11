// Supabase Edge Function: send-email
// Triggered by DB webhook on notifications table INSERT
// Uses Resend to deliver emails for key platform events
//
// Required env vars (set via Supabase dashboard):
//   RESEND_API_KEY — your Resend API key
//   SUPABASE_URL — auto-set by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-set by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// TODO: Replace with your verified Resend sending domain
const FROM_EMAIL = 'Juice Creators <notifications@mail.juicecreators.co.uk>';
const ADMIN_EMAIL = 'admin@juicecreators.com';

interface NotificationPayload {
  type: 'INSERT';
  table: 'notifications';
  record: {
    id: string;
    user_id: string;
    user_type: string;
    message: string;
    email_sent: boolean;
  };
}

interface WebhookPayload {
  type: string;
  table: string;
  record: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  try {
    const payload = (await req.json()) as WebhookPayload;

    // Only process notification inserts
    if (payload.table !== 'notifications' || payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const notification = payload.record as NotificationPayload['record'];

    // Skip if already sent
    if (notification.email_sent) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up the recipient email
    let recipientEmail: string | null = null;
    let recipientName = '';

    if (notification.user_type === 'creator') {
      const { data } = await supabase
        .from('creators')
        .select('email, name')
        .eq('id', notification.user_id)
        .single();
      if (data) {
        recipientEmail = data.email;
        recipientName = data.name;
      }
    } else if (notification.user_type === 'business') {
      const { data } = await supabase
        .from('businesses')
        .select('owner_email, name')
        .eq('id', notification.user_id)
        .single();
      if (data) {
        recipientEmail = data.owner_email;
        recipientName = data.name;
      }
    } else if (notification.user_type === 'admin') {
      recipientEmail = ADMIN_EMAIL;
      recipientName = 'Admin';
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'No recipient found' }), { status: 200 });
    }

    // Send via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500 });
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [recipientEmail],
        subject: `Juice Creators — ${notification.message.slice(0, 60)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px;">🧃</span>
              <h2 style="margin: 8px 0 0; color: #1a1025; font-size: 18px;">Juice Creators</h2>
            </div>
            <div style="background: #f8f5ff; border-radius: 12px; padding: 20px; border: 1px solid #e8e0f5;">
              <p style="margin: 0 0 4px; color: #666; font-size: 13px;">Hi ${recipientName},</p>
              <p style="margin: 0; color: #1a1025; font-size: 15px; font-weight: 600;">${notification.message}</p>
            </div>
            <p style="text-align: center; margin-top: 24px; color: #999; font-size: 12px;">
              — Juice Creators Platform
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errBody = await emailResponse.text();
      console.error('Resend error:', errBody);
      return new Response(JSON.stringify({ error: 'Email send failed' }), { status: 500 });
    }

    // Mark as sent to prevent duplicates
    await supabase
      .from('notifications')
      .update({ email_sent: true })
      .eq('id', notification.id);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
