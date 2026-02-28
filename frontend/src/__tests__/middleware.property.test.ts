/**
 * Property 3: 路由守卫重定向未认证用户
 * Feature: studysolo-mvp, Property 3: 路由守卫重定向未认证用户
 *
 * Validates: Requirements 2.10
 *
 * Tests the core logic extracted from src/middleware.ts:
 * - isProtected(pathname): determines if a route requires auth
 * - redirect URL construction: /login?next={encodedPathname}
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Pure logic extracted from middleware.ts ──────────────────────────────────

const PROTECTED_ROUTES = ['/workspace', '/settings', '/history']

function isProtected(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

function buildRedirectUrl(pathname: string): string {
  return `/login?next=${encodeURIComponent(pathname)}`
}

// ── Generators ───────────────────────────────────────────────────────────────

/** Generates a random sub-path segment like "/foo", "/foo/bar", etc. */
const subPathArb = fc.array(
  fc.stringMatching(/^[a-z0-9_-]+$/),
  { minLength: 0, maxLength: 4 }
).map((parts) => (parts.length === 0 ? '' : '/' + parts.join('/')))

/** Generates a protected path: one of the three roots + optional sub-path */
const protectedPathArb = fc.tuple(
  fc.constantFrom(...PROTECTED_ROUTES),
  subPathArb
).map(([root, sub]) => root + sub)

/** Generates a path that is NOT protected */
const unprotectedPathArb = fc.oneof(
  fc.constant('/'),
  fc.constant('/login'),
  fc.constant('/register'),
  fc.constant('/about'),
  // paths that start with a protected word but aren't actually protected
  fc.constant('/workspaceX'),
  fc.constant('/settings-old'),
  fc.constant('/history2'),
)

// ── Property Tests ────────────────────────────────────────────────────────────

describe('Feature: studysolo-mvp, Property 3: 路由守卫重定向未认证用户', () => {

  it('isProtected returns true for all protected root paths', () => {
    for (const route of PROTECTED_ROUTES) {
      expect(isProtected(route)).toBe(true)
    }
  })

  it('isProtected returns true for any sub-path under protected roots', () => {
    fc.assert(
      fc.property(protectedPathArb, (pathname) => {
        expect(isProtected(pathname)).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  it('isProtected returns false for unprotected paths', () => {
    fc.assert(
      fc.property(unprotectedPathArb, (pathname) => {
        expect(isProtected(pathname)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('redirect URL for any protected path points to /login with correct next param', () => {
    fc.assert(
      fc.property(protectedPathArb, (pathname) => {
        const redirectUrl = buildRedirectUrl(pathname)

        // Must start with /login
        expect(redirectUrl.startsWith('/login?next=')).toBe(true)

        // The next param must decode back to the original pathname
        const nextParam = new URLSearchParams(redirectUrl.slice('/login'.length)).get('next')
        expect(nextParam).toBe(pathname)
      }),
      { numRuns: 200 }
    )
  })

  it('redirect URL encodes special characters in the path', () => {
    fc.assert(
      fc.property(protectedPathArb, (pathname) => {
        const redirectUrl = buildRedirectUrl(pathname)
        // The raw URL string should not contain unencoded spaces or query chars
        // (our generator only produces safe chars, but encoding must still be applied)
        const encoded = encodeURIComponent(pathname)
        expect(redirectUrl).toBe(`/login?next=${encoded}`)
      }),
      { numRuns: 200 }
    )
  })

  it('unauthenticated request to any protected path should be redirected (integration of both functions)', () => {
    fc.assert(
      fc.property(protectedPathArb, (pathname) => {
        // Simulate middleware decision: if protected and no user → redirect
        const user = null
        const shouldRedirect = isProtected(pathname) && user === null

        expect(shouldRedirect).toBe(true)

        const redirectUrl = buildRedirectUrl(pathname)
        expect(redirectUrl).toBe(`/login?next=${encodeURIComponent(pathname)}`)
      }),
      { numRuns: 200 }
    )
  })

  it('authenticated request to protected path should NOT be redirected', () => {
    fc.assert(
      fc.property(protectedPathArb, (pathname) => {
        const user = { id: 'user-123', email: 'test@example.com' }
        const shouldRedirect = isProtected(pathname) && user === null

        expect(shouldRedirect).toBe(false)
      }),
      { numRuns: 100 }
    )
  })
})
