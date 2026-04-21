-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — update David Lloyd Clubs contact email
--
-- The legacy seed (20260420120000) only set contact_email via
-- COALESCE, so it never overwrote an existing value. The canonical
-- contact is now the David Lloyd Bury St Edmunds sales mailbox.
-- This migration force-updates the row to match.
-- ═══════════════════════════════════════════════════════════════

UPDATE businesses
   SET contact_email = 'sales.burystedmunds@davidlloyd.co.uk'
 WHERE name = 'David Lloyd Clubs';
