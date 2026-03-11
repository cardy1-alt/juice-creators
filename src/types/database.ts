export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_email: string;
          category: string;
          approved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_email: string;
          category: string;
          approved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          owner_email?: string;
          category?: string;
          approved?: boolean;
          created_at?: string;
        };
      };
      offers: {
        Row: {
          id: string;
          business_id: string;
          description: string;
          monthly_cap: number;
          is_live: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          description: string;
          monthly_cap?: number;
          is_live?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          description?: string;
          monthly_cap?: number;
          is_live?: boolean;
          created_at?: string;
        };
      };
      creators: {
        Row: {
          id: string;
          name: string;
          instagram_handle: string;
          code: string;
          email: string;
          approved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          instagram_handle: string;
          code: string;
          email: string;
          approved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          instagram_handle?: string;
          code?: string;
          email?: string;
          approved?: boolean;
          created_at?: string;
        };
      };
      claims: {
        Row: {
          id: string;
          creator_id: string;
          offer_id: string;
          business_id: string;
          status: string;
          qr_token: string;
          qr_expires_at: string;
          claimed_at: string;
          redeemed_at: string | null;
          reel_url: string | null;
          reel_due_at: string | null;
          month: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          offer_id: string;
          business_id: string;
          status?: string;
          qr_token: string;
          qr_expires_at: string;
          claimed_at?: string;
          redeemed_at?: string | null;
          reel_url?: string | null;
          reel_due_at?: string | null;
          month: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          offer_id?: string;
          business_id?: string;
          status?: string;
          qr_token?: string;
          qr_expires_at?: string;
          claimed_at?: string;
          redeemed_at?: string | null;
          reel_url?: string | null;
          reel_due_at?: string | null;
          month?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          user_type: string;
          message: string;
          read: boolean;
          email_sent: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_type: string;
          message: string;
          read?: boolean;
          email_sent?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          user_type?: string;
          message?: string;
          read?: boolean;
          email_sent?: boolean;
          created_at?: string;
        };
      };
      disputes: {
        Row: {
          id: string;
          claim_id: string;
          reporter_role: 'creator' | 'business';
          message: string;
          resolved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          reporter_role: 'creator' | 'business';
          message: string;
          resolved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          reporter_role?: 'creator' | 'business';
          message?: string;
          resolved?: boolean;
          created_at?: string;
        };
      };
    };
  };
};

export type UserRole = 'admin' | 'creator' | 'business';
