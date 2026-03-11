import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: users, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();

    if (fetchError) throw fetchError;

    const adminUser = users.users.find(u => u.email === 'admin@juicecreators.com');

    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: 'Admin user not found' }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      adminUser.id,
      { password: 'admin123' }
    );

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Admin password reset to: admin123',
        email: 'admin@juicecreators.com'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
