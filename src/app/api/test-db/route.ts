import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    // Log everything to understand the context structure
    console.log('Full context:', JSON.stringify(context, null, 2));
    console.log('Context keys:', Object.keys(context || {}));
    
    // Try different ways to access the environment
    const env1 = context?.cloudflare?.env;
    const env2 = context?.env;
    const env3 = (context as any)?.cloudflare;
    
    return NextResponse.json({
      success: true,
      debug: {
        hasCloudflare: !!context?.cloudflare,
        hasEnv: !!context?.env,
        hasDB1: !!env1?.DB,
        hasDB2: !!env2?.DB,
        contextKeys: Object.keys(context || {}),
        cloudflareKeys: context?.cloudflare ? Object.keys(context.cloudflare) : [],
        env1Keys: env1 ? Object.keys(env1) : [],
        env2Keys: env2 ? Object.keys(env2) : [],
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
