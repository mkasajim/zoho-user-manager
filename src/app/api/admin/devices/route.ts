import { NextRequest, NextResponse } from 'next/server';
import type { Env, Device } from '@/types/database';

export const runtime = 'edge';

async function verifyAdminToken(token: string, env: any) {
  if (!env?.DB) {
    // In local dev, just return true for any token
    return { valid: true };
  }
  
  const session = await env.DB.prepare(`
    SELECT * FROM admin_sessions 
    WHERE session_token = ? AND expires_at > datetime('now')
  `).bind(token).first();
  
  return session;
}

export async function GET(
  request: NextRequest,
  context: any
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
    
    // For Cloudflare Pages with Next.js, bindings are available through process.env
    const env = {
      DB: (process.env as any).DB,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      API_PASSWORD: process.env.API_PASSWORD
    } as Env;
    
    // If no DB binding available, return empty array (for local dev only)
    if (!env.DB) {
      return NextResponse.json([]);
    }
    
    const session = await verifyAdminToken(token, env);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    // Get all devices
    const devices = await env.DB.prepare(`
      SELECT * FROM devices ORDER BY created_at DESC
    `).all();
    
    return NextResponse.json(devices.results as unknown as Device[]);
  } catch (error) {
    console.error('Get devices error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}