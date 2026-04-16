'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

/**
 * Mounts Supabase auth session in routes outside the main (dashboard) layout.
 *
 * Without this, supabase-js won't auto-refresh expired access tokens because:
 * - The dashboard layout calls initCrossTabSync() which registers auth listeners.
 * - The /s/[id] layout is independent — it has no AuthProvider or auth listeners.
 *
 * This component performs a one-time getSession() call (which triggers an
 * automatic token refresh via the refresh_token if the access_token is expired)
 * and subscribes to future token-refresh events so subsequent social interactions
 * always have a fresh JWT available.
 *
 * Renders nothing — purely a side-effect component.
 */
export default function SessionRefresher() {
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    // Trigger session load + token auto-refresh if needed.
    // supabase-js v2 handles refresh internally via the stored refresh_token.
    supabase.auth.getSession().catch(() => {
      // Silently ignore: anonymous users / no session is a normal state
    });

    // Keep session fresh for the lifetime of this page
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // No-op: we only need the listener registered so the SDK fires
      // its internal "TOKEN_REFRESHED" machinery automatically.
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
