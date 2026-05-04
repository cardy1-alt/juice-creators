import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { BJ_STATS } from './pricing.js';

// Live newsletter metrics surfaced on the storefront. Source of
// truth is the bj_stats table (single-row, edited from the admin
// tab); BJ_STATS in pricing.ts is the build-time fallback so the
// page never renders blank if the fetch hasn't returned yet.

export interface BjStats {
  subscribers: number;
  open_rate: number;
  ctr: number;
}

const FALLBACK: BjStats = {
  subscribers: BJ_STATS.subscribers,
  open_rate: BJ_STATS.open_rate,
  ctr: BJ_STATS.ctr,
};

export function useBjStats(): BjStats {
  const [stats, setStats] = useState<BjStats>(FALLBACK);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('bj_stats')
      .select('subscribers,open_rate,ctr')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        // PostgREST returns numeric columns as strings; coerce here
        // so consumers can do arithmetic without surprises.
        setStats({
          subscribers: Number(data.subscribers),
          open_rate: Number(data.open_rate),
          ctr: Number(data.ctr),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return stats;
}
