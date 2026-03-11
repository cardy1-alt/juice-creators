import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TestUser {
  email: string;
  password: string;
  type: 'creator' | 'business' | 'admin';
  data: any;
}

const testUsers: TestUser[] = [
  {
    email: 'sophie@example.com',
    password: 'password123',
    type: 'creator',
    data: {
      name: 'Sophie Carter',
      instagram_handle: '@sophiecreates',
      code: 'SOPHIE01',
      approved: true
    }
  },
  {
    email: 'jamie@example.com',
    password: 'password123',
    type: 'creator',
    data: {
      name: 'Jamie Mills',
      instagram_handle: '@jamiemills_',
      code: 'JAMIE01',
      approved: true
    }
  },
  {
    email: 'lucy@example.com',
    password: 'password123',
    type: 'creator',
    data: {
      name: 'Lucy Thomas',
      instagram_handle: '@lucythomas',
      code: 'LUCY01',
      approved: true
    }
  },
  {
    email: 'midgar@example.com',
    password: 'password123',
    type: 'business',
    data: {
      name: 'Midgar Coffee',
      slug: 'midgar-coffee',
      approved: true
    }
  },
  {
    email: 'loyalwolf@example.com',
    password: 'password123',
    type: 'business',
    data: {
      name: 'Loyal Wolf Barbershop',
      slug: 'loyal-wolf',
      approved: true
    }
  },
  {
    email: 'yesyoucan@example.com',
    password: 'password123',
    type: 'business',
    data: {
      name: 'Yes You Can Fitness',
      slug: 'yes-you-can',
      approved: true
    }
  },
  {
    email: 'admin@juicecreators.com',
    password: 'password123',
    type: 'admin',
    data: {}
  }
];

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

    const results = [];

    for (const user of testUsers) {
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            type: user.type
          }
        });

        if (authError) {
          if (authError.message.includes('already exists') || authError.message.includes('already registered')) {
            results.push({ email: user.email, status: 'already_exists' });
            continue;
          }
          throw authError;
        }

        const userId = authData.user.id;

        if (user.type === 'creator') {
          await supabaseAdmin.from('creators').insert({
            id: userId,
            email: user.email,
            name: user.data.name,
            instagram_handle: user.data.instagram_handle,
            code: user.data.code,
            approved: user.data.approved
          });
        } else if (user.type === 'business') {
          await supabaseAdmin.from('businesses').insert({
            id: userId,
            name: user.data.name,
            slug: user.data.slug,
            owner_email: user.email,
            approved: user.data.approved
          });

          const { data: business } = await supabaseAdmin
            .from('businesses')
            .select('id')
            .eq('id', userId)
            .single();

          if (business) {
            const offers = [
              {
                business_id: business.id,
                description: user.data.name === 'Midgar Coffee'
                  ? 'Free Coffee & Pastry - Enjoy a complimentary coffee and pastry of your choice'
                  : user.data.name === 'Loyal Wolf Barbershop'
                  ? 'Complimentary Haircut - Get a free premium haircut or beard trim'
                  : 'Free Week Pass - 7-day unlimited gym access plus one personal training session',
                monthly_cap: 4,
                is_live: true
              }
            ];

            await supabaseAdmin.from('offers').insert(offers);
          }
        }

        results.push({ email: user.email, status: 'created', userId });
      } catch (error: any) {
        results.push({ email: user.email, status: 'error', error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
