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
      follower_count: '5k–10k',
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
      follower_count: '1k–5k',
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
      follower_count: '10k+',
      approved: true
    }
  },
  {
    email: 'alex@example.com',
    password: 'password123',
    type: 'creator',
    data: {
      name: 'Alex Rivera',
      instagram_handle: '@alexrivera',
      code: 'ALEX01',
      follower_count: '5k–10k',
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
      category: 'Food & Drink',
      address: '12 High Street, Bury St Edmunds, IP33 1TZ',
      latitude: 52.2462,
      longitude: 0.7142,
      bio: 'Specialty coffee & fresh pastries in the heart of town',
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
      category: 'Hair & Beauty',
      address: '8 Abbeygate Street, Bury St Edmunds, IP33 1UN',
      latitude: 52.2458,
      longitude: 0.7138,
      bio: 'Premium cuts & grooming for the modern gentleman',
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
      category: 'Health & Fitness',
      address: '45 Out Risbygate, Bury St Edmunds, IP33 3RN',
      latitude: 52.2470,
      longitude: 0.7155,
      bio: 'Transform your body with expert personal training',
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
            follower_count: user.data.follower_count || null,
            approved: user.data.approved
          });
        } else if (user.type === 'business') {
          await supabaseAdmin.from('businesses').insert({
            id: userId,
            name: user.data.name,
            slug: user.data.slug,
            owner_email: user.email,
            category: user.data.category || 'Food & Drink',
            address: user.data.address || null,
            latitude: user.data.latitude || null,
            longitude: user.data.longitude || null,
            bio: user.data.bio || null,
            approved: user.data.approved
          });

          const { data: business } = await supabaseAdmin
            .from('businesses')
            .select('id')
            .eq('id', userId)
            .single();

          if (business) {
            // Seed offers — mix of unlimited (null cap) and capped
            let offers: Array<{ business_id: string; description: string; monthly_cap: number | null; is_live: boolean }> = [];

            if (user.data.name === 'Midgar Coffee') {
              offers = [
                {
                  business_id: business.id,
                  description: 'Free Coffee & Pastry — Enjoy any coffee and pastry of your choice',
                  monthly_cap: null, // unlimited
                  is_live: true
                },
                {
                  business_id: business.id,
                  description: 'Brunch for Two — Full brunch spread with fresh juice',
                  monthly_cap: 3,
                  is_live: true
                }
              ];
            } else if (user.data.name === 'Loyal Wolf Barbershop') {
              offers = [
                {
                  business_id: business.id,
                  description: 'Complimentary Haircut — Premium cut or beard trim',
                  monthly_cap: 4,
                  is_live: true
                },
                {
                  business_id: business.id,
                  description: 'Full Grooming Package — Cut, beard, and hot towel',
                  monthly_cap: null, // unlimited
                  is_live: true
                }
              ];
            } else if (user.data.name === 'Yes You Can Fitness') {
              offers = [
                {
                  business_id: business.id,
                  description: 'Free Week Pass — 7-day unlimited gym access plus one PT session',
                  monthly_cap: null, // unlimited
                  is_live: true
                }
              ];
            }

            if (offers.length > 0) {
              await supabaseAdmin.from('offers').insert(offers);
            }
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
