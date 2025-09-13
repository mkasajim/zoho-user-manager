import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface CloudflareEnv {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  API_PASSWORD: string;
}

export async function GET(
  request: NextRequest,
  context: any
) {
  // Try different ways to access Cloudflare bindings
  const env1 = context.env;
  const env2 = context.cloudflare?.env;
  const params = context.params;
  
  // Check if bindings are in different locations
  const globalEnv = (globalThis as any).process?.env;
  const processEnv = process.env;
  
  return NextResponse.json({
    hasContext: !!context,
    contextKeys: Object.keys(context || {}),
    
    // Method 1: context.env
    hasEnv1: !!env1,
    env1Keys: env1 ? Object.keys(env1) : [],
    hasDB1: !!env1?.DB,
    
    // Method 2: context.cloudflare.env  
    hasEnv2: !!env2,
    env2Keys: env2 ? Object.keys(env2) : [],
    hasDB2: !!env2?.DB,
    
    // Check params
    hasParams: !!params,
    paramsKeys: params ? Object.keys(params) : [],
    
    // Check process.env
    processEnvKeys: processEnv ? Object.keys(processEnv).filter(k => k.includes('ADMIN') || k.includes('API') || k.includes('DB')) : [],
    
    // Test accessing bindings through process.env
    processEnvDB: !!(process.env as any).DB,
    processEnvAdmin: !!process.env.ADMIN_PASSWORD,
    processEnvAPI: !!process.env.API_PASSWORD,
    
    // Check DB type
    dbType: typeof (process.env as any).DB,
    
    rawContext: JSON.stringify(context, null, 2).substring(0, 500)
  });
}
