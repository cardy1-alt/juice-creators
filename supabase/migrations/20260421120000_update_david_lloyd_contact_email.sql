-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — clear David Lloyd Clubs contact email
--
-- David Lloyd is primarily a Nayba brand; the BJ comp placement is a
-- membership-exchange on the side and the contact should never be
-- routed through Bury Juice. An earlier legacy seed attempted to set
-- `contact_email` on her row via COALESCE. This migration NULLs that
-- value so Bury Juice holds no email on file for her.
--
-- Safe to apply multiple times. The WHERE clause only touches the
-- specific David Lloyd row; Nayba login (`owner_email`) is untouched.
-- ═══════════════════════════════════════════════════════════════

UPDATE businesses
   SET contact_email = NULL
 WHERE id = 'c1a6cafa-dd51-433b-86ce-defe8c678ea6';
