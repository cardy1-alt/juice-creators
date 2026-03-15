-- ============================================================
-- CREATOR GAMIFICATION: levels, streaks, profile completeness
-- ============================================================

-- CREATORS TABLE — new columns
ALTER TABLE creators ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS level_name TEXT DEFAULT 'Newcomer';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS total_reels INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS last_reel_month TEXT; -- format: '2026-03'
ALTER TABLE creators ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT false;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS bio TEXT;

-- OFFERS TABLE — min_level for access tiers
ALTER TABLE offers ADD COLUMN IF NOT EXISTS min_level INTEGER DEFAULT 1;

-- CLAIMS TABLE — reel_submitted_at for leaderboard
ALTER TABLE claims ADD COLUMN IF NOT EXISTS reel_submitted_at TIMESTAMPTZ;

-- LEVEL CALCULATION FUNCTION
CREATE OR REPLACE FUNCTION calculate_creator_level(
  p_total_reels INTEGER,
  p_avg_rating DECIMAL
) RETURNS TABLE(level INTEGER, level_name TEXT) AS $$
BEGIN
  IF p_total_reels >= 21 AND p_avg_rating >= 4.8 THEN
    RETURN QUERY SELECT 6, 'Nayba'::TEXT;
  ELSIF p_total_reels >= 11 AND p_avg_rating >= 4.5 THEN
    RETURN QUERY SELECT 5, 'Trusted'::TEXT;
  ELSIF p_total_reels >= 6 THEN
    RETURN QUERY SELECT 4, 'Local'::TEXT;
  ELSIF p_total_reels >= 3 THEN
    RETURN QUERY SELECT 3, 'Regular'::TEXT;
  ELSIF p_total_reels >= 1 THEN
    RETURN QUERY SELECT 2, 'Explorer'::TEXT;
  ELSE
    RETURN QUERY SELECT 1, 'Newcomer'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- LEVEL UP TRIGGER
CREATE OR REPLACE FUNCTION update_creator_level()
RETURNS TRIGGER AS $$
DECLARE
  new_level_data RECORD;
BEGIN
  SELECT * INTO new_level_data
    FROM calculate_creator_level(NEW.total_reels, NEW.average_rating);
  NEW.level := new_level_data.level;
  NEW.level_name := new_level_data.level_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_creator_level ON creators;
CREATE TRIGGER trigger_update_creator_level
  BEFORE UPDATE OF total_reels, average_rating ON creators
  FOR EACH ROW EXECUTE FUNCTION update_creator_level();

-- WEEKLY LEADERBOARD VIEW
CREATE OR REPLACE VIEW weekly_leaderboard AS
SELECT
  c.id,
  c.display_name,
  c.name,
  c.avatar_url,
  c.level,
  c.level_name,
  COUNT(cl.id) AS reels_this_week
FROM creators c
LEFT JOIN claims cl ON cl.creator_id = c.id
  AND cl.reel_submitted_at >= date_trunc('week', NOW())
  AND cl.reel_url IS NOT NULL
GROUP BY c.id, c.display_name, c.name, c.avatar_url, c.level, c.level_name
HAVING COUNT(cl.id) > 0
ORDER BY reels_this_week DESC
LIMIT 10;
