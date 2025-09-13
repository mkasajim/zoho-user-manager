import { NextRequest, NextResponse } from 'next/server';
import type { Env } from '@/types/database';

export const runtime = 'edge';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const body = await request.json() as { password: string };
    const { password } = body;
    
    // For Cloudflare Pages with Next.js, bindings are available through process.env
    const env = {
      DB: (process.env as any).DB,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      API_PASSWORD: process.env.API_PASSWORD
    } as Env;
    
    // Use fallback values for local dev if no bindings
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'admin123';
    
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }
    
    // Generate session token
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Store session in database (skip in local dev if no DB)
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO admin_sessions (session_token, expires_at) 
        VALUES (?, ?)
      `).bind(sessionToken, expiresAt.toISOString()).run();
    }
    
    return NextResponse.json({ token: sessionToken });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}