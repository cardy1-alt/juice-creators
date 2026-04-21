-- ═══════════════════════════════════════════════════════════════
-- NAYBA — update David Lloyd Clubs owner email
--
-- Moving the David Lloyd Bury St Edmunds brand from
--   salesmanager.burystedmunds@davidlloyd.co.uk
-- to the shorter sales mailbox
--   sales.burystedmunds@davidlloyd.co.uk
--
-- owner_email is what Nayba matches the logged-in auth user against
-- (see BusinessPortal fetchBrand — `.eq('owner_email', user.email)`),
-- so after applying this migration the matching Supabase Auth user's
-- email MUST also be updated via the Supabase dashboard or admin API.
-- Until both are in sync she won't be able to log in.
--
-- Safe to run multiple times; the WHERE clause targets the old
-- address and the row's UUID to avoid hitting anyone else.
-- ═══════════════════════════════════════════════════════════════

UPDATE businesses
   SET owner_email = 'sales.burystedmunds@davidlloyd.co.uk'
 WHERE id = 'c1a6cafa-dd51-433b-86ce-defe8c678ea6'
   AND owner_email = 'salesmanager.burystedmunds@davidlloyd.co.uk';
