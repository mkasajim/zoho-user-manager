import { NextRequest, NextResponse } from 'next/server';
import type { Env, DeviceSigninRequest } from '@/types/database';

export const runtime = 'edge';

export async function POST(
  request: NextRequest,
  context: { cloudflare?: { env: Env } }
) {
  try {
    const data: DeviceSigninRequest = await request.json();
    
    // For local development, use environment variables
    const env = context.cloudflare?.env || {
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
      API_PASSWORD: process.env.API_PASSWORD || 'panda',
      DB: null
    } as any;
    
    const {
      password,
      hostname,
      os,
      arch,
      cpu,
      mac_address,
      disk_serial,
      system_uuid,
      motherboard_serial,
      cpu_id
    } = data;
    
    // Input sanitization
    const sanitizedData = {
      hostname,
      os: os || null,
      arch: arch || null,
      cpu: cpu || null,
      mac_address: mac_address || null,
      disk_serial: disk_serial || null,
      system_uuid: system_uuid || null,
      motherboard_serial: motherboard_serial || null,
      cpu_id: cpu_id || null
    };
    
    if (password !== env.API_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Invalid API password' },
        { status: 401 }
      );
    }
    
    if (!hostname) {
      return NextResponse.json(
        { success: false, error: 'Hostname is required' },
        { status: 400 }
      );
    }
    
    // In local dev without DB, just return success
    if (!env.DB) {
      return NextResponse.json({
        success: true,
        message: 'Device signin successful (local dev)',
        device_id: 1
      });
    }
    
    // Check if device exists using unique identifiers
    let device = null;
    if (system_uuid) {
      device = await env.DB.prepare(`
        SELECT * FROM devices WHERE system_uuid = ?
      `).bind(system_uuid).first();
    }
    
    // Fallback to MAC address if no device found by UUID
    if (!device && mac_address) {
      device = await env.DB.prepare(`
        SELECT * FROM devices WHERE mac_address = ?
      `).bind(mac_address).first();
    }
    
    if (device) {
      // Device exists, check if blocked
      if (device.is_blocked) {
        return NextResponse.json(
          { success: false, error: 'Device is blocked' },
          { status: 403 }
        );
      }
      
      // Update last signin time
      await env.DB.prepare(`
        UPDATE devices SET last_signin = datetime('now') WHERE id = ?
      `).bind(device.id).run();
      
      return NextResponse.json({
        success: true,
        message: 'Device signin successful',
        device_id: device.id
      });
    } else {
      // Create new device
      const result = await env.DB.prepare(`
        INSERT INTO devices (
          hostname, os, arch, cpu, mac_address, disk_serial,
          system_uuid, motherboard_serial, cpu_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        sanitizedData.hostname,
        sanitizedData.os,
        sanitizedData.arch,
        sanitizedData.cpu,
        sanitizedData.mac_address,
        sanitizedData.disk_serial,
        sanitizedData.system_uuid,
        sanitizedData.motherboard_serial,
        sanitizedData.cpu_id
      ).run();
      
      return NextResponse.json({
        success: true,
        message: 'New device registered and signed in',
        device_id: result.meta.last_row_id
      });
    }
  } catch (error) {
    console.error('Device signin error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request data or server error' },
      { status: 400 }
    );
  }
}