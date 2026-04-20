import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to read a feature flag from the `feature_flags` config table.
 * Returns false by default (safe fallback) until the flag is loaded.
 *
 * Usage:
 *   const jaEnabled = useFeatureFlag('enabled_ja_compliance');
 *   if (jaEnabled) { ... show JA fields ... }
 */
export function useFeatureFlag(key: string): boolean {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', key)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) {
          setEnabled(data.enabled);
        }
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [key]);

  return enabled;
}

/**
 * Hook that returns both the flag value and loading state.
 * Useful when you need to show a loading indicator while flags load.
 */
export function useFeatureFlagWithLoading(key: string): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', key)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setEnabled(data?.enabled ?? false);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [key]);

  return { enabled, loading };
}
