import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
  /** Unique channel name */
  channel: string;
  /** Table to listen to */
  table: string;
  /** Event type to listen for (default: '*' = all) */
  event?: PostgresChangeEvent;
  /** Optional filter, e.g. 'channel_id=eq.xxx' */
  filter?: string;
  /** Schema (default: 'public') */
  schema?: string;
}

/**
 * Hook for subscribing to Supabase Realtime postgres_changes.
 * Automatically cleans up subscriptions on unmount.
 *
 * Usage:
 *   useRealtimeChannel({
 *     channel: 'shift-updates',
 *     table: 'shifts',
 *     event: 'INSERT',
 *   }, (payload) => {
 *     console.log('New shift:', payload.new);
 *   });
 */
export function useRealtimeChannel(
  options: UseRealtimeOptions,
  callback: (payload: Record<string, unknown>) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const { channel, table, event = '*', filter, schema = 'public' } = options;

    const channelConfig: Record<string, unknown> = {
      event,
      schema,
      table,
    };
    if (filter) channelConfig.filter = filter;

    const sub = supabase
      .channel(channel)
      .on('postgres_changes', channelConfig, callback)
      .subscribe();

    channelRef.current = sub;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.channel, options.table, options.event, options.filter]);
}

/**
 * Hook for subscribing to a Supabase Realtime broadcast channel.
 * Used for custom events like typing indicators, presence, etc.
 *
 * Usage:
 *   useRealtimeBroadcast('typing-channel', 'typing', (payload) => {
 *     console.log('User typing:', payload);
 *   });
 */
export function useRealtimeBroadcast(
  channelName: string,
  eventName: string,
  callback: (payload: Record<string, unknown>) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const sub = supabase
      .channel(channelName)
      .on('broadcast', { event: eventName }, callback)
      .subscribe();

    channelRef.current = sub;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, eventName]);
}
