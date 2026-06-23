"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AreaChart, BarChart, LineChart } from '@/components/charts';
import { useApiSWR, apiCache } from '@/lib/hooks/useApi';
import { notify, NotificationService } from '@/lib/notification';

interface EntryLog {
  entry_id: number;
  entry_time: string;
  exit_time: string | null;
  user_id: number;
  rfid_code: string | null;
  purpose: string | null;
  verified_by: number | null;
  user?: {
    full_name: string;
    account_id: string;
    user_type: string;
    year_level?: string;
    department_id?: number;
    department_ref?: {
      name: string;
    };
    program?: {
      name: string;
    };
  };
}

interface EntryStatistics {
  totalToday: number;
  totalThisWeek: number;
  totalThisMonth: number;
  uniqueUsersToday: number;
  uniqueUsersWeek: number;
  uniqueUsersMonth: number;
  peakHour: string;
  currentlyInside: number;
  departmentBreakdown: { [key: string]: number };
  hourlyTrends: Array<{ hour: string; entries: number }>;
  yearLevelDistribution: { [key: string]: number };
}

interface AdminViewProps {
  className?: string;
}

export default function AdminView({ className }: AdminViewProps) {
  const { data: session } = useSession();
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    office: '',
    gradeLevelId: '',
    yearLevel: '',
    dateFrom: '',
    dateTo: '',
    status: 'all' // all, inside, exited
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(20);

  // Tabs
  const [activeTab, setActiveTab] = useState<'monitoring' | 'analytics'>('monitoring');

  // Real-time connection status
  const [isLive, setIsLive] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  // Fetch departments
  const { data: departmentsResponse } = useApiSWR<any>('/api/departments');
  const departments = React.useMemo(() => {
    if (!departmentsResponse) return [];
    const depts = departmentsResponse.data || departmentsResponse || [];
    return Array.isArray(depts) ? depts : [];
  }, [departmentsResponse]);

  // Fetch offices
  const { data: officesResponse } = useApiSWR<any>('/api/offices');
  const offices = React.useMemo(() => {
    if (!officesResponse) return [];
    const offs = officesResponse.data || officesResponse || [];
    return Array.isArray(offs) ? offs : [];
  }, [officesResponse]);

  // Build API endpoint with filters
  const buildApiEndpoint = useCallback(() => {
    const queryParams = new URLSearchParams();
    
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.department) queryParams.append('department', filters.department);
    // Office filter: send office_id so backend can filter by user.office_id
    if (filters.office) queryParams.append('office_id', filters.office);
    if (filters.gradeLevelId) queryParams.append('grade_level_id', filters.gradeLevelId);
    if (filters.yearLevel) queryParams.append('year_level', filters.yearLevel);
    if (filters.dateFrom) queryParams.append('date_from', filters.dateFrom);
    if (filters.dateTo) queryParams.append('date_to', filters.dateTo);
    if (filters.status !== 'all') queryParams.append('status', filters.status);
    
    queryParams.append('limit', '100'); // Get more logs for admin view
    queryParams.append('include_user', 'true');
    
    return `/api/entry-logs?${queryParams.toString()}`;
  }, [filters]);

  // SWR for entry logs
  const { 
    data: entryLogsResponse, 
    error: logsError, 
    isLoading: logsLoading,
    mutate: refreshLogs 
  } = useApiSWR<any>(buildApiEndpoint(), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });


  // Process entry logs data
  const entryLogs = React.useMemo(() => {
    if (!entryLogsResponse) return [];
    
    // Handle different API response formats
    if (Array.isArray(entryLogsResponse)) {
      return entryLogsResponse;
    }
    
    // Check for nested data structures
    const logs = entryLogsResponse.logs || 
                 entryLogsResponse.data?.logs || 
                 entryLogsResponse.data || 
                 [];
    
    return Array.isArray(logs) ? logs : [];
  }, [entryLogsResponse]);

  // Keep a ref of the latest entry logs so the SSE handler (which has a
  // long-lived closure) can look up user info for exit events whose payload
  // doesn't include the nested `user` object.
  const entryLogsRef = useRef<EntryLog[]>([]);
  useEffect(() => {
    entryLogsRef.current = entryLogs;
  }, [entryLogs]);

  // SWR for statistics
  const { 
    data: statisticsResponse, 
    error: statsError, 
    isLoading: statisticsLoading,
    mutate: refreshStats 
  } = useApiSWR<any>('/api/entry-logs/statistics', {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  // Process statistics data
  const statistics = React.useMemo(() => {
    if (!statisticsResponse) return null;
    
    // Handle different response structures
    const stats = statisticsResponse.statistics || 
                  statisticsResponse.data?.statistics || 
                  statisticsResponse;
    
    // Ensure default structure
    return stats ? {
      totalToday: stats.totalToday || 0,
      totalThisWeek: stats.totalThisWeek || 0,
      totalThisMonth: stats.totalThisMonth || 0,
      uniqueUsersToday: stats.uniqueUsersToday || 0,
      uniqueUsersWeek: stats.uniqueUsersWeek || 0,
      uniqueUsersMonth: stats.uniqueUsersMonth || 0,
      currentlyInside: stats.currentlyInside || 0,
      peakHour: stats.peakHour || 'N/A',
      departmentBreakdown: stats.departmentBreakdown || {},
      yearLevelDistribution: stats.yearLevelDistribution || {},
      hourlyTrends: stats.hourlyTrends || Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, '0')}:00`,
        entries: 0
      }))
    } : null;
  }, [statisticsResponse]);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      department: '',
      office: '',
      gradeLevelId: '',
      yearLevel: '',
      dateFrom: '',
      dateTo: '',
      status: 'all'
    });
    setCurrentPage(1);
  };

  // Real-time updates via Server-Sent Events (SSE).
  // Reuses the same /api/entry-logs/stream endpoint as StaffView so admin
  // receives entry/exit events the moment a staff logs them.
  useEffect(() => {
    const source = new EventSource('/api/entry-logs/stream');

    source.onopen = () => setIsLive(true);

    source.onmessage = (event) => {
      if (!event.data) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'entry-log' && data.payload) {
          const payload: any = data.payload;
          setLastEventAt(new Date());

          // Determine if this is a new entry or an exit update
          const isExit = !!payload.exit_time && !!payload.entry_id;

          if (isExit) {
            // Update the matching entry's exit_time in the cached list
            refreshLogs(
              (current: any) => {
                if (!current) return current;
                const logs =
                  current.logs || current.data?.logs || (Array.isArray(current) ? current : []);
                if (!Array.isArray(logs) || logs.length === 0) return current;

                const nextLogs = logs.map((log: any) =>
                  log.entry_id === payload.entry_id
                    ? { ...log, ...payload }
                    : log
                );

                return Array.isArray(current)
                  ? nextLogs
                  : current.logs
                  ? { ...current, logs: nextLogs }
                  : { ...current, data: { ...(current.data || {}), logs: nextLogs } };
              },
              { revalidate: false }
            );
          } else {
            // New entry: prepend to the cached list and re-validate stats
            refreshLogs(
              (current: any) => {
                if (!current) {
                  return { logs: [payload] };
                }
                const logs =
                  current.logs || current.data?.logs || (Array.isArray(current) ? current : []);
                if (!Array.isArray(logs)) return current;

                // Avoid duplicate inserts if the same event arrives twice
                if (logs.some((l: any) => l.entry_id === payload.entry_id)) return current;

                const nextLogs = [payload, ...logs];

                return Array.isArray(current)
                  ? nextLogs
                  : current.logs
                  ? { ...current, logs: nextLogs }
                  : { ...current, data: { ...(current.data || {}), logs: nextLogs } };
              },
              { revalidate: false }
            );
          }

          // Always re-validate statistics so the dashboard reflects the change
          refreshStats();

          // Brief visual feedback (only on the monitoring tab to avoid noise)
          if (activeTab === 'monitoring') {
            // Exit payloads from the backend omit the nested `user` object,
            // so fall back to the matching cached entry's name.
            const cachedEntry = isExit
              ? entryLogsRef.current.find((l) => l.entry_id === payload.entry_id)
              : undefined;
            const name =
              payload?.user?.full_name ||
              cachedEntry?.user?.full_name ||
              (payload?.user_id ? `User #${payload.user_id}` : 'A user');
            if (isExit) {
              NotificationService.toast(`${name} exited the library`, 'info');
            } else {
              NotificationService.toast(`${name} entered the library`, 'success');
            }
          }
        }
      } catch {
        // Ignore malformed payloads
      }
    };

    source.onerror = () => {
      setIsLive(false);
      // Close so the browser will auto-retry; do a one-time re-fetch as a safety net
      source.close();
      refreshLogs();
      refreshStats();
    };

    return () => {
      source.close();
      setIsLive(false);
    };
    // We intentionally don't include refreshLogs/refreshStats in deps: SWR returns
    // stable mutate references per key, and re-subscribing on every render would
    // drop the live connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);


  // Pagination
  const totalPages = Math.ceil(entryLogs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const currentLogs = entryLogs.slice(startIndex, startIndex + logsPerPage);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className={`max-w-full ${className}`}>
      {/* Tabs */}
      <div className="bg-white border-b mb-6">
        <div className="">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('monitoring')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'monitoring'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className="fas fa-eye mr-2"></i>
              Real-time Monitoring
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className="fas fa-chart-line mr-2"></i>
              Analytics
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'monitoring' && (
        <div className=" py-4">
          {/* Filters Section */}
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Filters & Search</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  size="sm"
                >
                  Clear All
                </Button>
              </div>
            </div>
            
            {/* Primary Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
              <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <Input
                  type="text"
                  placeholder="Search by name, ID, or department..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <Select
                  value={filters.department}
                  onValueChange={(value) => handleFilterChange('department', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Departments</SelectItem>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.department_id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Office
                </label>
                <Select
                  value={filters.office}
                  onValueChange={(value) => handleFilterChange('office', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Offices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Offices</SelectItem>
                    {offices.map((office: any) => (
                      <SelectItem key={office.office_id} value={String(office.name)}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grade Level
                </label>
                <Select
                  value={filters.gradeLevelId}
                  onValueChange={(value) => handleFilterChange('gradeLevelName', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    {/*  */}
                    <SelectItem value="">All Grades</SelectItem>
                    <SelectItem value="1">Kindergarten</SelectItem>
                    <SelectItem value="2">Grade 1</SelectItem>
                    <SelectItem value="3">Grade 2</SelectItem>
                    <SelectItem value="4">Grade 3</SelectItem>
                    <SelectItem value="5">Grade 4</SelectItem>
                    <SelectItem value="6">Grade 5</SelectItem>
                    <SelectItem value="7">Grade 6</SelectItem>
                    <SelectItem value="8">Grade 7</SelectItem>
                    <SelectItem value="9">Grade 8</SelectItem>
                    <SelectItem value="10">Grade 9</SelectItem>
                    <SelectItem value="11">Grade 10</SelectItem>
                    <SelectItem value="12">Grade 11</SelectItem>
                    <SelectItem value="13">Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year Level
                </label>
                <Select
                  value={filters.yearLevel}
                  onValueChange={(value) => handleFilterChange('yearLevel', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Years</SelectItem>
                    {/* College */}
                    <SelectItem value="1st Year">1st Year</SelectItem>
                    <SelectItem value="2nd Year">2nd Year</SelectItem>
                    <SelectItem value="3rd Year">3rd Year</SelectItem>
                    <SelectItem value="4th Year">4th Year</SelectItem>
                    <SelectItem value="5th Year">5th Year</SelectItem>
                    {/* Graduate School */}
                    <SelectItem value="1st Year Graduate">1st Year Graduate</SelectItem>
                    <SelectItem value="2nd Year Graduate">2nd Year Graduate</SelectItem>
                    <SelectItem value="3rd Year Graduate">3rd Year Graduate</SelectItem>
                    <SelectItem value="Thesis Writing">Thesis Writing</SelectItem>
                    <SelectItem value="Dissertation Writing">Dissertation Writing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Entries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entries</SelectItem>
                    <SelectItem value="inside">Currently Inside</SelectItem>
                    <SelectItem value="exited">Exited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Date Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Date
                </label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Date
                </label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="sm:col-span-2 lg:col-span-2 flex items-end">
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md w-full">
                  <div className="flex items-center justify-between">
                    <span>
                      <strong>{entryLogs.length}</strong> entries found
                    </span>
                    {(filters.search || filters.department || filters.office || filters.yearLevel || filters.dateFrom || filters.dateTo || filters.status !== 'all') && (
                      <Badge variant="outline" className="text-xs">
                        Filtered
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Entry Logs Table */}
          <Card className="overflow-hidden">
            <div className="py-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Real-time Entry Logs
                    </h3>
                   
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {entryLogs.length} entries • Page {currentPage} of {totalPages || 1}
                    {lastEventAt && (
                      <span className="ml-2 text-xs text-gray-400">
                        • Updated {lastEventAt.toLocaleTimeString()}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Rows per page:</span>
                    <Select
                      value={String(logsPerPage)}
                      onValueChange={(value) => {
                        setLogsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {logsLoading && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <LoadingSpinner size="sm" />
                      <span>Loading...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entry Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Information
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm text-gray-500 mb-2">No entry logs found</p>
                          <p className="text-xs text-gray-400">
                            {filters.search || filters.department || filters.office || filters.yearLevel || filters.dateFrom || filters.dateTo || filters.status !== 'all'
                              ? "Try adjusting your filters to see more results"
                              : "Entry logs will appear here once users start entering the library"
                            }
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentLogs.map((log) => (
                      <tr key={log.entry_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatTime(log.entry_time)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(log.entry_time)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {log.user?.full_name || `User ID: ${log.user_id}`}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {log.user?.account_id || log.user_id} • {log.user?.user_type || 'Loading...'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {log.user?.department_ref?.name || 'N/A'}
                          </div>
                          {log.user?.program && (
                            <div className="text-xs text-gray-500">
                              {log.user.program.name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {log.user?.year_level || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={log.exit_time ? "outline" : "success"}
                              className="w-fit"
                            >
                              {log.exit_time ? (
                                'Exited'
                              ) : (
                                <span className="inline-flex items-center gap-2">
                                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                                  Inside
                                </span>
                              )}
                            </Badge>
                            {log.exit_time ? (
                              <div className="text-xs text-gray-500 space-y-0.5">
                                <div>
                                  <span className="font-medium text-gray-600">Entered:</span> {formatTime(log.entry_time)}
                                </div>
                                <div>
                                  <span className="font-medium text-gray-600">Exited:</span> {formatTime(log.exit_time)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">Entered:</span> {formatTime(log.entry_time)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-50 text-blue-700">
                            {log.purpose || 'General'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(startIndex + logsPerPage, entryLogs.length)}
                    </span>{' '}
                    of <span className="font-medium">{entryLogs.length}</span> entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="px-6 py-4">
          {statisticsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <LoadingSpinner size="lg" />
                <p className="text-sm text-gray-600 mt-2">Loading analytics...</p>
              </div>
            </div>
          ) : statistics ? (
            <>
              {/* Statistics Overview */}
              <div className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-600 mb-1">Today's Entries</h3>
                        <div className="text-2xl font-bold text-green-600">{statistics.totalToday}</div>
                        <div className="text-xs text-gray-500">Unique: {statistics.uniqueUsersToday}</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-600 mb-1">This Week</h3>
                        <div className="text-2xl font-bold text-blue-600">{statistics.totalThisWeek}</div>
                        <div className="text-xs text-gray-500">Unique: {statistics.uniqueUsersWeek}</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-600 mb-1">Currently Inside</h3>
                        <div className="text-2xl font-bold text-orange-600">{statistics.currentlyInside}</div>
                        <div className="text-xs text-gray-500">Active sessions</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-600 mb-1">Peak Hour</h3>
                        <div className="text-2xl font-bold text-purple-600">{statistics.peakHour}</div>
                        <div className="text-xs text-gray-500">Busiest time</div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Charts Section */}
              <div className="mb-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Hourly Entry Trends</h3>
                      <div className="text-xs text-gray-500">Last 24 hours</div>
                    </div>
                    <div className="h-64">
                      <LineChart 
                        data={statistics.hourlyTrends.map((item: any) => ({ 
                          name: item.hour, 
                          entries: item.entries 
                        }))} 
                        lines={[{ dataKey: 'entries', stroke: '#3b82f6', name: 'Entries' }]}
                        height={250} 
                      />
                    </div>
                  </Card>
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Department Distribution</h3>
                      <div className="text-xs text-gray-500">Today's entries</div>
                    </div>
                    <div className="h-64">
                      <BarChart
                        data={Object.entries(statistics.departmentBreakdown).map(([dept, count]) => ({
                          name: dept.length > 15 ? dept.substring(0, 15) + '...' : dept,
                          entries: count as number,
                        }))}
                        bars={[{ dataKey: 'entries', fill: '#10b981', name: 'Entries' }]}
                        height={250}
                      />
                    </div>
                  </Card>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <i className="fas fa-exclamation-triangle text-4xl text-gray-300 mb-4"></i>
                <p className="text-sm text-gray-600 mb-2">Analytics data unavailable</p>
                <p className="text-xs text-gray-500">Statistics could not be loaded. Please try refreshing the page.</p>
              </div>
            </div>
          )}
        </div>
      )}
      {/*
       
      */}
    </div>
  );
}