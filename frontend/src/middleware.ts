import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route guard middleware:
 * - /c/* (private canvas): requires access_token cookie
 * - /workspace/* (dashboard): requires access_token cookie
 * - /s/* (shared public): accessible by anyone
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;

  const protectedPrefixes = ['/c/', '/workspace'];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/c/:path*', '/workspace/:path*'],
};
