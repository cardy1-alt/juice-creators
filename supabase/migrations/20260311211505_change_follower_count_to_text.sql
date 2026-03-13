/*
  # Change follower_count from integer to text

  1. Changes
    - Alter `follower_count` column in `creators` table from integer to text
    - Preserve existing data by converting to appropriate text ranges

  2. Security
    - No changes to RLS policies
*/

-- Only run the conversion if follower_count is still an integer type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'creators'
      AND column_name = 'follower_count'
      AND data_type = 'integer'
  ) THEN
    -- Create a temporary column to store the text values
    ALTER TABLE creators ADD COLUMN follower_count_temp text;

    -- Convert existing numeric values to text ranges
    UPDATE creators
    SET follower_count_temp =
      CASE
        WHEN follower_count < 1000 THEN 'Under 1k'
        WHEN follower_count >= 1000 AND follower_count < 5000 THEN '1k–5k'
        WHEN follower_count >= 5000 AND follower_count < 10000 THEN '5k–10k'
        WHEN follower_count >= 10000 THEN '10k+'
        ELSE 'Under 1k'
      END;

    -- Drop the old integer column
    ALTER TABLE creators DROP COLUMN follower_count;

    -- Rename the temp column to follower_count
    ALTER TABLE creators RENAME COLUMN follower_count_temp TO follower_count;
  END IF;
END $$;
