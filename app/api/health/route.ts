import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_CHAT_ORIGINS, isPerformanceMode, isRewriteIntervention } from '../../../config/product';
import { checkLocalApiHealth } from '../../../lib/localHealth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedOrigins = new Set<string>(SUPPORTED_CHAT_ORIGINS);

function corsHeaders(request?: NextRequest) {
  const origin = request?.headers.get('origin');
  const allowedOrigin =
    !origin || allowedOrigins.has(origin) || origin.startsWith('chrome-extension://')
      ? origin || 'http://127.0.0.1:3000'
      : 'null';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-PromptClarity-Token',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin'
  };
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: NextRequest) {
  const requestedMode = request.nextUrl.searchParams.get('mode');
  const mode = isPerformanceMode(requestedMode) ? requestedMode : 'fast';
  const requestedIntervention = request.nextUrl.searchParams.get('intervention');
  const intervention = isRewriteIntervention(requestedIntervention) ? requestedIntervention : 'normal';
  const health = await checkLocalApiHealth({ mode, intervention });
  return NextResponse.json(health, {
    status: health.status === 'ok' ? 200 : 503,
    headers: corsHeaders(request)
  });
}
