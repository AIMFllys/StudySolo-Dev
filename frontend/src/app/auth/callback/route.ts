/**
 * Supabase Auth Callback Handler
 *
 * Handles two flows:
 *   1. Email verification: user clicks link → code exchange → redirect to /login?verified=true
 *   2. OAuth login (GitHub/Google): provider redirects → code exchange → upsert user_profiles → redirect to /workspace
 *
 * Flow:
 *   1. Supabase redirects to /auth/callback?code=xxx&next=yyy
 *   2. This route exchanges the code for a session (PKCE)
 *   3. For OAuth users, upserts user_profiles so the profile row exists
 *   4. Redirects to `next` param (defaults to /login?verified=true for email, /workspace for OAuth)
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  // For OAuth logins, the `next` param is typically `/workspace`.
  // We must route through /login first so AuthSessionBridge can sync
  // the Supabase session into backend HttpOnly cookies (access_token).
  // Without this, server components on /workspace would get 401 because
  // the backend cookie hasn't been set yet.
  const rawNext = searchParams.get('next')
  // OAuth logins pass next=/workspace; email verification has no next param.
  // For OAuth we route through /login so AuthSessionBridge can sync the
  // Supabase session into backend HttpOnly cookies before entering /workspace.
  // We also pass oauth=1 so the login page knows this is an OAuth flow
  // and can handle sync + redirect more reliably.
  const next = rawNext
    ? `/login?next=${encodeURIComponent(rawNext)}&oauth=1`
    : '/login?verified=true'

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=verification_failed', origin)
    )
  }

  const supabaseResponse = NextResponse.redirect(new URL(next, origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=verification_failed', origin)
    )
  }

  // Ensure user_profiles row exists for OAuth users.
  // Uses upsert to avoid race conditions and conflicts with email-registered profiles.
  // on_conflict=id means: if a profile already exists, do nothing (preserve existing data).
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const meta = user.user_metadata ?? {}

      // Derive a display name from provider metadata.
      // GitHub: user_name / full_name / name
      // Google: full_name / name
      const displayName =
        meta.full_name ||
        meta.name ||
        meta.user_name ||
        meta.preferred_username ||
        ''

      await supabase
        .from('user_profiles')
        .upsert(
          {
            id: user.id,
            email: user.email ?? '',
            nickname: displayName,
            avatar_url: meta.avatar_url || meta.picture || '',
            registered_from: 'studysolo',
            tier: 'free',
          },
          { onConflict: 'id', ignoreDuplicates: true }
        )
    }
  } catch {
    // Non-fatal: profile sync is best-effort.
    console.warn('[auth/callback] user_profiles upsert failed (non-fatal)')
  }

  return supabaseResponse
}
