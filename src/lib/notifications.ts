import { supabase } from './supabase';

/**
 * Insert a notification that triggers the send-email edge function via webhook.
 * The edge function reads email_type to pick the right template and email_meta
 * for template variables.
 */
async function insertNotification(params: {
  userId: string;
  userType: 'creator' | 'business' | 'admin';
  message: string;
  emailType: string;
  emailMeta?: Record<string, string>;
}): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    user_type: params.userType,
    message: params.message,
    email_type: params.emailType,
    email_meta: params.emailMeta || {},
  });
  if (error) {
    console.error(`[notifications] Failed to insert ${params.emailType}:`, error.message);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function sendCreatorWelcomeEmail(creatorId: string): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: 'Welcome to Nayba! Explore local collabs and claim your first one.',
    emailType: 'creator_welcome',
  });
}

export async function sendBusinessWelcomeEmail(businessId: string): Promise<void> {
  await insertNotification({
    userId: businessId,
    userType: 'business',
    message: 'Welcome to Nayba! Create your first collab to start attracting creators.',
    emailType: 'business_welcome',
  });
}

export async function sendAdminSignupNotification(params: {
  userType: 'creator' | 'business';
  displayName: string;
  email: string;
}): Promise<void> {
  await insertNotification({
    userId: '00000000-0000-0000-0000-000000000000', // placeholder for admin notifications
    userType: 'admin',
    message: `New ${params.userType} signup: ${params.displayName} (${params.email})`,
    emailType: 'admin_signup',
    emailMeta: {
      user_type: params.userType,
      display_name: params.displayName,
      email: params.email,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function sendCreatorApprovedEmail(creatorId: string): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: 'Your creator account has been approved! Start exploring collabs.',
    emailType: 'creator_approved',
  });
}

export async function sendBusinessApprovedEmail(businessId: string): Promise<void> {
  await insertNotification({
    userId: businessId,
    userType: 'business',
    message: 'Your business account has been approved! Create your first collab.',
    emailType: 'business_approved',
  });
}

export async function sendCreatorDeniedEmail(creatorId: string): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: 'Your creator application was not approved at this time.',
    emailType: 'creator_denied',
  });
}

export async function sendBusinessDeniedEmail(businessId: string): Promise<void> {
  await insertNotification({
    userId: businessId,
    userType: 'business',
    message: 'Your business application was not approved at this time.',
    emailType: 'business_denied',
  });
}

export async function sendAdminApprovalRequest(params: {
  userType: 'creator' | 'business';
  userId: string;
  displayName: string;
  email: string;
}): Promise<void> {
  await insertNotification({
    userId: '00000000-0000-0000-0000-000000000000',
    userType: 'admin',
    message: `New ${params.userType} awaiting approval: ${params.displayName} (${params.email})`,
    emailType: 'admin_approval_request',
    emailMeta: {
      user_type: params.userType,
      user_id: params.userId,
      display_name: params.displayName,
      email: params.email,
    },
  });
}

export async function sendFeedbackEmail(params: {
  userId: string;
  userType: 'creator' | 'business';
  displayName: string;
  page: string;
  feedback: string;
}): Promise<void> {
  // Save to feedback table
  await supabase.from('feedback').insert({
    user_id: params.userId,
    user_type: params.userType,
    display_name: params.displayName,
    page: params.page,
    message: params.feedback,
  });

  // Send email notification
  await insertNotification({
    userId: '00000000-0000-0000-0000-000000000000',
    userType: 'admin',
    message: `Feedback from ${params.displayName}: ${params.feedback.slice(0, 100)}`,
    emailType: 'feedback',
    emailMeta: {
      user_id: params.userId,
      user_type: params.userType,
      display_name: params.displayName,
      page: params.page,
      feedback: params.feedback,
    },
  });
}
