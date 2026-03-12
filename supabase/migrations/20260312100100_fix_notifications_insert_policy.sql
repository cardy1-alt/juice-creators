/*
  # Remove permissive notifications INSERT policy

  The existing WITH CHECK (true) policy allows any authenticated user to insert
  notifications targeting any other user. Remove it so only Edge Functions using
  the service role key can insert notifications.
*/

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
