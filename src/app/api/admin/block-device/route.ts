import { NextRequest, NextResponse } from 'next/server';
import type { Env } from '@/types/database';

export const runtime = 'edge';

async function verifyAdminToken(token: string, env: any) {
  if (!env.DB) {
    // In local dev, just return true for any token
    return { valid: true };
  }
  
  const session = await env.DB.prepare(`
    SELECT * FROM admin_sessions 
    WHERE session_token = ? AND expires_at > datetime('now')
  `).bind(token).first();
  
  return session;
}

export async function POST(
  request: NextRequest,
  context: { cloudflare?: { env: Env } }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    
    // For local development, use environment variables
    const env = context.cloudflare?.env || {
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
      API_PASSWORD: process.env.API_PASSWORD || 'panda',
      DB: null
    } as any;
    
    // In local dev without DB, just return success
    if (!env.DB) {
      return NextResponse.json({ success: true });
    }
    
    const session = await verifyAdminToken(token, env);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    const body = await request.json() as { deviceId: string; block: boolean };
    const { deviceId, block } = body;
    
    await env.DB.prepare(`
      UPDATE devices SET is_blocked = ? WHERE id = ?
    `).bind(block ? 1 : 0, deviceId).run();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Block device error:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}