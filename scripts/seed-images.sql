-- ============================================================
-- NAYBA — Image Seed Script
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- to add hero images to existing campaigns and logos to brands.
--
-- All images are from Unsplash (free, no attribution required
-- for commercial use). Using Unsplash Source URLs for auto-
-- optimised delivery.
-- ============================================================

-- ─── Campaign Hero Images ───
-- Update any campaigns that don't already have an image.
-- Uses category-appropriate Unsplash photos.

-- Food & Drink campaigns
UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%')
  AND id = (SELECT id FROM campaigns WHERE campaign_image IS NULL AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%') ORDER BY created_at LIMIT 1);

UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%')
  AND id = (SELECT id FROM campaigns WHERE campaign_image IS NULL AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%') ORDER BY created_at LIMIT 1);

-- Beauty campaigns
UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Beauty%' OR category ILIKE '%Hair%')
  AND id = (SELECT id FROM campaigns WHERE campaign_image IS NULL AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Beauty%' OR category ILIKE '%Hair%') ORDER BY created_at LIMIT 1);

-- Wellness campaigns
UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Wellness%' OR category ILIKE '%Spa%' OR category ILIKE '%Health%' OR category ILIKE '%Fitness%')
  AND id = (SELECT id FROM campaigns WHERE campaign_image IS NULL AND brand_id IN (SELECT id FROM businesses WHERE category ILIKE '%Wellness%' OR category ILIKE '%Spa%' OR category ILIKE '%Health%' OR category ILIKE '%Fitness%') ORDER BY created_at LIMIT 1);

-- Fallback: any remaining campaigns without images
UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND id = (SELECT id FROM campaigns WHERE campaign_image IS NULL ORDER BY created_at LIMIT 1);

UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND id = (SELECT id FROM campaigns WHERE campaign_image IS NULL ORDER BY created_at LIMIT 1);

UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND id = (SELECT id FROM campaigns WHERE campaign_image IS NULL ORDER BY created_at LIMIT 1);

UPDATE campaigns SET campaign_image = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=450&fit=crop'
WHERE campaign_image IS NULL
  AND id = (SELECT id FROM campaigns WHERE campaign_image IS NULL ORDER BY created_at LIMIT 1);

-- ─── Brand Logos ───
-- Add logo_url to businesses that don't have one.
-- Using brand-appropriate lifestyle images as logos.

UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=200&h=200&fit=crop'
WHERE logo_url IS NULL AND (category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%')
  AND id = (SELECT id FROM businesses WHERE logo_url IS NULL AND (category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%') ORDER BY created_at LIMIT 1);

UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=200&h=200&fit=crop'
WHERE logo_url IS NULL AND (category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%')
  AND id = (SELECT id FROM businesses WHERE logo_url IS NULL AND (category ILIKE '%Food%' OR category ILIKE '%Cafe%' OR category ILIKE '%Coffee%') ORDER BY created_at LIMIT 1);

UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&h=200&fit=crop'
WHERE logo_url IS NULL AND (category ILIKE '%Beauty%' OR category ILIKE '%Hair%')
  AND id = (SELECT id FROM businesses WHERE logo_url IS NULL AND (category ILIKE '%Beauty%' OR category ILIKE '%Hair%') ORDER BY created_at LIMIT 1);

UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=200&h=200&fit=crop'
WHERE logo_url IS NULL AND (category ILIKE '%Wellness%' OR category ILIKE '%Spa%' OR category ILIKE '%Health%' OR category ILIKE '%Fitness%')
  AND id = (SELECT id FROM businesses WHERE logo_url IS NULL AND (category ILIKE '%Wellness%' OR category ILIKE '%Spa%' OR category ILIKE '%Health%' OR category ILIKE '%Fitness%') ORDER BY created_at LIMIT 1);

-- Fallback for remaining brands
UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200&h=200&fit=crop'
WHERE logo_url IS NULL
  AND id = (SELECT id FROM businesses WHERE logo_url IS NULL ORDER BY created_at LIMIT 1);

UPDATE businesses SET logo_url = 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=200&h=200&fit=crop'
WHERE logo_url IS NULL
  AND id = (SELECT id FROM businesses WHERE logo_url IS NULL ORDER BY created_at LIMIT 1);

-- ─── Summary ───
SELECT 'Campaigns with images' as metric, COUNT(*) as count FROM campaigns WHERE campaign_image IS NOT NULL
UNION ALL
SELECT 'Campaigns without images', COUNT(*) FROM campaigns WHERE campaign_image IS NULL
UNION ALL
SELECT 'Brands with logos', COUNT(*) FROM businesses WHERE logo_url IS NOT NULL
UNION ALL
SELECT 'Brands without logos', COUNT(*) FROM businesses WHERE logo_url IS NULL;
