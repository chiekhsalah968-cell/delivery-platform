import { NextResponse, type NextRequest } from 'next/server';
import { authedApi } from '@/lib/authed-api';

/**
 * Authenticated BFF proxy for the public resource APIs. The client never sees
 * tokens; this handler attaches the httpOnly access cookie and forwards the
 * request to the NestJS API, which enforces RBAC. Only the public resource
 * prefixes below are proxied — admin endpoints are intentionally excluded and
 * live solely in the private admin app.
 */
const ALLOWED_PREFIXES = new Set(['geo', 'profiles', 'vehicles', 'addresses']);

async function handle(request: NextRequest, segments: string[]): Promise<NextResponse> {
  if (
    segments.length === 0 ||
    !ALLOWED_PREFIXES.has(segments[0] ?? '') ||
    segments.some((s) => s === '.' || s === '..' || s.length === 0)
  ) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const search = request.nextUrl.search;
  const path = `/api/${segments.join('/')}${search}`;
  const method = request.method;
  const body = method === 'GET' || method === 'DELETE' ? undefined : await request.text();

  const upstream = await authedApi(path, {
    method,
    ...(body !== undefined && body.length > 0 ? { body } : {}),
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return handle(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return handle(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return handle(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return handle(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return handle(request, (await ctx.params).path);
}