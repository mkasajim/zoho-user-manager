'use client';

import { useState, useEffect } from 'react';
import { LogOut, Shield, ShieldOff, Monitor, RefreshCw, Search, Filter } from 'lucide-react';
import type { Device } from '@/types/database';

interface DeviceDashboardProps {
  token: string;
  onLogout: () => void;
}

export default function DeviceDashboard({ token, onLogout }: DeviceDashboardProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/devices', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        if (response.status === 401) {
          onLogout();
          return;
        }
        throw new Error('Failed to load devices');
      }

      const data = await response.json() as Device[];
      setDevices(data);
      setError('');
    } catch (error) {
      setError('Failed to load devices');
      console.error('Error loading devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDeviceStatus = async (deviceId: number, isCurrentlyBlocked: boolean) => {
    try {
      setActionLoading(deviceId);
      const response = await fetch('/api/admin/block-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deviceId,
          block: !isCurrentlyBlocked
        })
      });

      if (response.ok) {
        await loadDevices();
      } else {
        setError('Failed to update device status');
      }
    } catch (error) {
      setError('Error updating device status');
      console.error('Error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.os?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.mac_address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = statusFilter === 'all' ||
                         (statusFilter === 'active' && !device.is_blocked) ||
                         (statusFilter === 'blocked' && device.is_blocked);
    
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Monitor className="w-8 h-8 text-blue-500 mr-3" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Device Management
              </h1>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm min-w-[250px] text-gray-900 placeholder:text-gray-500"
                />
              </div>
              <div className="relative">
                <Filter className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm appearance-none text-gray-900"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="blocked">Blocked Only</option>
                </select>
              </div>
            </div>
            <button
              onClick={loadDevices}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Monitor className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Devices</p>
                <p className="text-2xl font-bold text-gray-900">{devices.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-xl">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Devices</p>
                <p className="text-2xl font-bold text-gray-900">
                  {devices.filter(d => !d.is_blocked).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-xl">
                <ShieldOff className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Blocked Devices</p>
                <p className="text-2xl font-bold text-gray-900">
                  {devices.filter(d => d.is_blocked).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Devices Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          {filteredDevices.length === 0 ? (
            <div className="p-12 text-center">
              <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
              <p className="text-gray-500">No devices match your current search and filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hardware</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDevices.map((device) => (
                    <tr key={device.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{device.hostname}</div>
                          <div className="text-sm text-gray-500 font-mono">{device.mac_address || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm text-gray-900">{device.os || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{device.arch || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{device.cpu || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          device.is_blocked
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {device.is_blocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(device.last_signin)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleDeviceStatus(device.id, device.is_blocked)}
                          disabled={actionLoading === device.id}
                          className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            device.is_blocked
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          } disabled:opacity-50`}
                        >
                          {actionLoading === device.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : device.is_blocked ? (
                            <>Unblock</>
                          ) : (
                            <>Block</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}