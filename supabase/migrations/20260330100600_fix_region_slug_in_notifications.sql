/*
  # Fix region slug formatting in notification messages

  The notify_creators_on_business_live trigger inserts raw region slugs
  (e.g. 'bury-st-edmunds') into notification messages. This fix formats
  the region to title case (e.g. 'Bury St Edmunds') before insertion.
*/

CREATE OR REPLACE FUNCTION format_region_name(slug text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT initcap(replace(slug, '-', ' '));
$$;

CREATE OR REPLACE FUNCTION notify_creators_on_business_live()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator RECORD;
  v_region_display text;
BEGIN
  IF NEW.is_live = true AND (OLD IS NULL OR OLD.is_live = false) THEN
    v_region_display := COALESCE(format_region_name(NEW.region), 'your area');
    FOR v_creator IN
      SELECT id FROM creators
      WHERE region IS NOT NULL AND region = NEW.region
    LOOP
      INSERT INTO notifications (user_id, user_type, message, title, body, read)
      VALUES (
        v_creator.id,
        'creator',
        'New business near you: ' || NEW.name || ' just joined Nayba in ' || v_region_display || '.',
        'New business near you',
        NEW.name || ' just joined Nayba in ' || v_region_display || '. Check out their collabs.',
        false
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_business_live ON businesses;
CREATE TRIGGER trg_notify_on_business_live
  AFTER UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION notify_creators_on_business_live();
