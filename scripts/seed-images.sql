-- ============================================================
-- NAYBA — Add Image Columns + Seed Script
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
--
-- Step 1: Adds missing columns (campaign_image, logo_url)
-- Step 2: Seeds campaigns and brands with Unsplash photos
-- ============================================================

-- ─── Step 1: Add columns if they don't exist ───

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_image TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'brand';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ─── Step 2: Seed Campaign Hero Images ───
-- Category-matched Unsplash photos for visual demo

-- Food & Drink campaigns
UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%')
  AND id = (SELECT c2.id FROM campaigns c2 WHERE c2.campaign_image IS NULL AND c2.brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%') ORDER BY c2.created_at LIMIT 1);

UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%')
  AND id = (SELECT c2.id FROM campaigns c2 WHERE c2.campaign_image IS NULL AND c2.brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%') ORDER BY c2.created_at LIMIT 1);

-- Beauty campaigns
UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Beauty%' OR category ILIKE '%Hair%')
  AND id = (SELECT c2.id FROM campaigns c2 WHERE c2.campaign_image IS NULL AND c2.brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Beauty%' OR category ILIKE '%Hair%') ORDER BY c2.created_at LIMIT 1);

-- Wellness campaigns
UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Wellness%' OR category ILIKE '%Spa%' OR category ILIKE '%Health%' OR category ILIKE '%Fitness%')
  AND id = (SELECT c2.id FROM campaigns c2 WHERE c2.campaign_image IS NULL AND c2.brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Wellness%' OR category ILIKE '%Spa%' OR category ILIKE '%Health%' OR category ILIKE '%Fitness%') ORDER BY c2.created_at LIMIT 1);

-- Fallback: any remaining campaigns without images
UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL AND id = (SELECT c2.id FROM campaigns c2 WHERE c2.campaign_image IS NULL ORDER BY c2.created_at LIMIT 1);

UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL AND id = (SELECT c2.id FROM campaigns c2 WHERE c2.campaign_image IS NULL ORDER BY c2.created_at LIMIT 1);

UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL AND id = (SELECT c2.id FROM campaigns c2 WHERE c2.campaign_image IS NULL ORDER BY c2.created_at LIMIT 1);

UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL AND id = (SELECT c2.id FROM campaigns c2 WHERE c2.campaign_image IS NULL ORDER BY c2.created_at LIMIT 1);

-- ─── Step 3: Seed Brand Logos ───

UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=200&h=200&fit=crop'
WHERE logo_url IS NULL AND (category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%')
  AND id = (SELECT b2.id FROM businesses b2 WHERE b2.logo_url IS NULL AND (b2.category ILIKE '%Food%' OR b2.category ILIKE '%Cafe%' OR b2.category ILIKE '%Coffee%') ORDER BY b2.created_at LIMIT 1);

UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=200&h=200&fit=crop'
WHERE logo_url IS NULL AND (category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%')
  AND id = (SELECT b2.id FROM businesses b2 WHERE b2.logo_url IS NULL AND (b2.category ILIKE '%Food%' OR b2.category ILIKE '%Cafe%' OR b2.category ILIKE '%Coffee%') ORDER BY b2.created_at LIMIT 1);

UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&h=200&fit=crop'
WHERE logo_url IS NULL AND (category ILIKE '%Beauty%' OR category ILIKE '%Hair%')
  AND id = (SELECT b2.id FROM businesses b2 WHERE b2.logo_url IS NULL AND (b2.category ILIKE '%Beauty%' OR b2.category ILIKE '%Hair%') ORDER BY b2.created_at LIMIT 1);

UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=200&h=200&fit=crop'
WHERE logo_url IS NULL AND (category ILIKE '%Wellness%' OR category ILIKE '%Spa%' OR category ILIKE '%Health%' OR category ILIKE '%Fitness%')
  AND id = (SELECT b2.id FROM businesses b2 WHERE b2.logo_url IS NULL AND (b2.category ILIKE '%Wellness%' OR b2.category ILIKE '%Spa%' OR b2.category ILIKE '%Health%' OR b2.category ILIKE '%Fitness%') ORDER BY b2.created_at LIMIT 1);

-- Fallback for remaining brands
UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200&h=200&fit=crop'
WHERE logo_url IS NULL AND id = (SELECT b2.id FROM businesses b2 WHERE b2.logo_url IS NULL ORDER BY b2.created_at LIMIT 1);

UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=200&h=200&fit=crop'
WHERE logo_url IS NULL AND id = (SELECT b2.id FROM businesses b2 WHERE b2.logo_url IS NULL ORDER BY b2.created_at LIMIT 1);

-- ─── Summary ───
SELECT 'Campaigns with images' as metric, COUNT(*) as count FROM campaigns WHERE campaign_image IS NOT NULL
UNION ALL
SELECT 'Campaigns without images', COUNT(*) FROM campaigns WHERE campaign_image IS NULL
UNION ALL
SELECT 'Brands with logos', COUNT(*) FROM businesses WHERE logo_url IS NOT NULL
UNION ALL
SELECT 'Brands without logos', COUNT(*) FROM businesses WHERE logo_url IS NULL;
