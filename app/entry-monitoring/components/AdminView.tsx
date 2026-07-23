"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AreaChart, BarChart, LineChart, Heatmap } from '@/components/charts';
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
  campus?: 'COLLEGE' | 'BASIC_EDUCATION' | null;
  entrance_id?: number | null;
  entrance?: {
    entrance_id: number;
    name: string;
    campus: 'COLLEGE' | 'BASIC_EDUCATION';
  } | null;
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

interface Entrance {
  entrance_id: number
  name: string
  campus: 'COLLEGE' | 'BASIC_EDUCATION'
  is_active: boolean
}

// Shape of the payload returned by
// /api/entry-logs/analytics. Kept inline so the
// AdminView doesn't need to round-trip through
// /types for analytics-only data.
interface AnalyticsTrendPoint {
  label: string
  key?: string
  entries: number
  exits: number
}
interface AnalyticsSummary {
  totalEntries: number
  totalExits: number
  uniqueUsers: number
  currentlyInside: number
  peakBucket: { label: string; entries: number; exits: number }
  interval: 'hour' | 'day' | 'week' | 'month'
  daySpan: number
}
interface AnalyticsScope {
  dateFrom: string
  dateTo: string
  campus: 'COLLEGE' | 'BASIC_EDUCATION' | null
  entrance_id: number | number[] | null
  userType: string | null
  interval: 'hour' | 'day' | 'week' | 'month'
}
interface AnalyticsCampusSeries {
  name: string
  data: Array<{ key: string; entries: number }>
  stroke?: string
}
interface AnalyticsEntranceSeries {
  entrance_id: number
  name: string
  campus: 'COLLEGE' | 'BASIC_EDUCATION' | null
  data: Array<{ key: string; entries: number }>
}
interface AnalyticsHeatmaps {
  hourOfDay: Array<{ hour: number; label: string; entries: number }>
  dayOfWeek: Array<{ dow: number; label: string; entries: number }>
}
interface AnalyticsBreakdowns {
  byCampus: Array<{ campus: string; entries: number }>
  byEntrance: Array<{
    entrance_id: number | null
    name: string
    campus: 'COLLEGE' | 'BASIC_EDUCATION' | null
    entries: number
  }>
  byUserType: Array<{ userType: string; entries: number }>
  byDepartment: Array<{ department: string; entries: number }>
  byProgram: Array<{ program: string; entries: number }>
  byGradeLevel: Array<{ gradeLevel: string; entries: number }>
  byYearLevel: Array<{ yearLevel: string; entries: number }>
  byPurpose: Array<{ purpose: string; entries: number }>
}
interface AnalyticsPayload {
  scope: AnalyticsScope
  summary: AnalyticsSummary
  trend: AnalyticsTrendPoint[]
  campusSeries: AnalyticsCampusSeries[]
  entranceSeries: AnalyticsEntranceSeries[]
  heatmaps: AnalyticsHeatmaps
  breakdowns: AnalyticsBreakdowns
}

// Quick-pick presets for the analytics date
// selector. "custom" hides the preset and shows
// the two date inputs. The list covers every
// "common" window the LIBADMIN wants to look at:
// hour, day, week, month, last 90 days, this year,
// last 365 days, and an explicit custom range.
type DatePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisYear'
  | 'last7'
  | 'last30'
  | 'last90'
  | 'last365'
  | 'custom'

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
    campus: '',
    entranceId: '',
    dateFrom: '',
    dateTo: '',
    status: 'all' // all, inside, exited
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(20);

  // Tabs
  const [activeTab, setActiveTab] = useState<'monitoring' | 'analytics'>('monitoring');

  // ---- Analytics-tab filters ----
  // Kept separate from the monitoring-table filters
  // because they answer different questions:
  //   - Monitoring = "which rows should the table
  //     show right now" (always most-recent-N,
  //     search, status, etc.)
  //   - Analytics = "what period + what scope do I
  //     want to chart" (date range, campus, entrance,
  //     user type, demographic; bucket size is
  //     auto-derived from the range).
  // Sharing them would force the user to re-pick
  // their date range every time they switched tabs.
  const [analyticsFilters, setAnalyticsFilters] = useState<{
    preset: DatePreset
    dateFrom: string
    dateTo: string
    campus: '' | 'COLLEGE' | 'BASIC_EDUCATION'
    entranceId: string
    userType: '' | 'STUDENT' | 'EMPLOYEE' | 'ALUMNI' | 'GUEST'
    departmentId: string
    programId: string
    gradeLevelId: string
  }>(() => {
    // Default to "Today" so the analytics tab is
    // immediately useful on first load.
    const today = new Date()
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return {
      preset: 'today' as DatePreset,
      dateFrom: iso,
      dateTo: iso,
      campus: '',
      entranceId: '',
      userType: '',
      departmentId: '',
      programId: '',
      gradeLevelId: ''
    }
  })

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

  // Fetch entrances (used for the campus / library
  // filter on both tabs). The endpoint is open to
  // any authenticated user.
  const { data: entrancesResponse } = useApiSWR<any>(
    '/api/entrances?include_archived=false'
  );
  const allEntrances: Entrance[] = useMemo(() => {
    if (!entrancesResponse) return []
    const d: any = entrancesResponse
    if (Array.isArray(d)) return d
    if (Array.isArray(d.data)) return d.data
    return []
  }, [entrancesResponse])

  // Programs (loaded lazily for the analytics tab
  // demographic filter).
  const { data: programsResponse } = useApiSWR<any>(
    activeTab === 'analytics' ? '/api/programs' : null
  );
  const programs = React.useMemo(() => {
    if (!programsResponse) return [];
    const d: any = programsResponse
    if (Array.isArray(d)) return d
    if (Array.isArray(d.data)) return d.data
    return []
  }, [programsResponse])

  // Grade levels (loaded lazily).
  const { data: gradeLevelsResponse } = useApiSWR<any>(
    activeTab === 'analytics' ? '/api/grade-levels' : null
  );
  const gradeLevels = React.useMemo(() => {
    if (!gradeLevelsResponse) return [];
    const d: any = gradeLevelsResponse
    if (Array.isArray(d)) return d
    if (Array.isArray(d.data)) return d.data
    return []
  }, [gradeLevelsResponse])

  // Build API endpoint with filters
  const buildApiEndpoint = useCallback(() => {
    const queryParams = new URLSearchParams();

    if (filters.search) queryParams.append('search', filters.search);
    if (filters.department) queryParams.append('department', filters.department);
    if (filters.office) queryParams.append('office_id', filters.office);
    if (filters.gradeLevelId) queryParams.append('grade_level_id', filters.gradeLevelId);
    if (filters.yearLevel) queryParams.append('year_level', filters.yearLevel);
    if (filters.campus) queryParams.append('campus', filters.campus);
    if (filters.entranceId) queryParams.append('entrance_id', filters.entranceId);
    if (filters.dateFrom) queryParams.append('date_from', filters.dateFrom);
    if (filters.dateTo) queryParams.append('date_to', filters.dateTo);
    if (filters.status !== 'all') queryParams.append('status', filters.status);

    queryParams.append('limit', '100');
    queryParams.append('include_user', 'true');

    return `/api/entry-logs?${queryParams.toString()}`;
  }, [filters]);

  // Monitoring-table entrance list, campus-scoped
  // so the dropdown never offers an entrance that
  // doesn't match the current campus filter.
  const visibleEntrances = useMemo(() => {
    const list = allEntrances.filter((e) => e.is_active !== false)
    if (!filters.campus) return list
    return list.filter((e) => e.campus === filters.campus)
  }, [allEntrances, filters.campus])

  // SWR for entry logs (monitoring table)
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

    if (Array.isArray(entryLogsResponse)) {
      return entryLogsResponse;
    }

    const logs = entryLogsResponse.logs ||
                 entryLogsResponse.data?.logs ||
                 entryLogsResponse.data ||
                 [];

    return Array.isArray(logs) ? logs : [];
  }, [entryLogsResponse]);

  const entryLogsRef = useRef<EntryLog[]>([]);
  useEffect(() => {
    entryLogsRef.current = entryLogs;
  }, [entryLogs]);

  // ---- Analytics helpers ----
  // Date-preset math. Centralised here so the
  // `dateFrom` / `dateTo` ISO strings stay in sync
  // with the dropdown label.
  const applyDatePreset = useCallback((preset: DatePreset) => {
    const today = new Date()
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const todayIso = iso(today)
    if (preset === 'today') {
      setAnalyticsFilters((prev) => ({ ...prev, preset, dateFrom: todayIso, dateTo: todayIso }))
    } else if (preset === 'yesterday') {
      const y = new Date(today)
      y.setDate(today.getDate() - 1)
      const yIso = iso(y)
      setAnalyticsFilters((prev) => ({ ...prev, preset, dateFrom: yIso, dateTo: yIso }))
    } else if (preset === 'thisWeek') {
      const start = new Date(today)
      start.setDate(today.getDate() - start.getDay())
      setAnalyticsFilters((prev) => ({ ...prev, preset, dateFrom: iso(start), dateTo: todayIso }))
    } else if (preset === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      setAnalyticsFilters((prev) => ({ ...prev, preset, dateFrom: iso(start), dateTo: todayIso }))
    } else if (preset === 'thisYear') {
      const start = new Date(today.getFullYear(), 0, 1)
      setAnalyticsFilters((prev) => ({ ...prev, preset, dateFrom: iso(start), dateTo: todayIso }))
    } else if (preset === 'last7') {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      setAnalyticsFilters((prev) => ({ ...prev, preset, dateFrom: iso(start), dateTo: todayIso }))
    } else if (preset === 'last30') {
      const start = new Date(today)
      start.setDate(today.getDate() - 29)
      setAnalyticsFilters((prev) => ({ ...prev, preset, dateFrom: iso(start), dateTo: todayIso }))
    } else if (preset === 'last90') {
      const start = new Date(today)
      start.setDate(today.getDate() - 89)
      setAnalyticsFilters((prev) => ({ ...prev, preset, dateFrom: iso(start), dateTo: todayIso }))
    } else if (preset === 'last365') {
      const start = new Date(today)
      start.setDate(today.getDate() - 364)
      setAnalyticsFilters((prev) => ({ ...prev, preset, dateFrom: iso(start), dateTo: todayIso }))
    } else {
      setAnalyticsFilters((prev) => ({ ...prev, preset }))
    }
  }, [])

  // Analytics-tab entrance list, campus-scoped.
  const visibleAnalyticsEntrances = useMemo(() => {
    const list = allEntrances.filter((e) => e.is_active !== false)
    if (!analyticsFilters.campus) return list
    return list.filter((e) => e.campus === analyticsFilters.campus)
  }, [allEntrances, analyticsFilters.campus])

  // SWR key for the comprehensive analytics endpoint.
  const analyticsKey = useMemo(() => {
    const params = new URLSearchParams()
    params.append('date_from', analyticsFilters.dateFrom)
    params.append('date_to', analyticsFilters.dateTo)
    if (analyticsFilters.campus) params.append('campus', analyticsFilters.campus)
    if (analyticsFilters.entranceId) params.append('entrance_id', analyticsFilters.entranceId)
    if (analyticsFilters.userType) params.append('userType', analyticsFilters.userType)
    if (analyticsFilters.departmentId) params.append('departmentId', analyticsFilters.departmentId)
    if (analyticsFilters.programId) params.append('programId', analyticsFilters.programId)
    if (analyticsFilters.gradeLevelId) params.append('gradeLevelId', analyticsFilters.gradeLevelId)
    return `/api/entry-logs/analytics?${params.toString()}`
  }, [analyticsFilters])

  const {
    data: analyticsResponse,
    isLoading: analyticsLoading,
    mutate: refreshAnalytics
  } = useApiSWR<AnalyticsPayload>(
    activeTab === 'analytics' ? analyticsKey : null,
    { dedupingInterval: 1000 }
  )

  // Normalise the analytics response so the render
  // path always has the same shape.
  const analytics: AnalyticsPayload | null = useMemo(() => {
    if (!analyticsResponse) return null
    const r: any = analyticsResponse
    if (r && typeof r === 'object' && 'summary' in r && 'breakdowns' in r) return r as AnalyticsPayload
    if (r?.data && typeof r.data === 'object' && 'summary' in r.data) return r.data as AnalyticsPayload
    return null
  }, [analyticsResponse])

  // Legacy statistics — still used by the older
  // quick-glance cards (today / week / month) for
  // backwards compatibility.
  const {
    data: statisticsResponse,
    mutate: refreshStats
  } = useApiSWR<any>('/api/entry-logs/statistics', {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const statistics = React.useMemo(() => {
    if (!statisticsResponse) return null;
    const stats = statisticsResponse.statistics ||
                  statisticsResponse.data?.statistics ||
                  statisticsResponse;
    return stats ? {
      totalToday: stats.totalToday || 0,
      totalThisWeek: stats.totalThisWeek || 0,
      totalThisMonth: stats.totalThisMonth || 0,
      currentlyInside: stats.currentlyInside || 0,
      peakHour: stats.peakHour || 'N/A',
      departmentBreakdown: stats.departmentBreakdown || {}
    } : null;
  }, [statisticsResponse]);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      department: '',
      office: '',
      gradeLevelId: '',
      yearLevel: '',
      campus: '',
      entranceId: '',
      dateFrom: '',
      dateTo: '',
      status: 'all'
    });
    setCurrentPage(1);
  };

  // Real-time updates via Server-Sent Events (SSE).
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

          const isExit = !!payload.exit_time && !!payload.entry_id;

          if (isExit) {
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
            refreshLogs(
              (current: any) => {
                if (!current) {
                  return { logs: [payload] };
                }
                const logs =
                  current.logs || current.data?.logs || (Array.isArray(current) ? current : []);
                if (!Array.isArray(logs)) return current;
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

          refreshStats();
          // Re-validate the comprehensive analytics
          // payload so the charts stay current.
          refreshAnalytics();

          if (activeTab === 'monitoring') {
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
      source.close();
      refreshLogs();
      refreshStats();
      refreshAnalytics();
    };

    return () => {
      source.close();
      setIsLive(false);
    };
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
              Library Access Report
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
                    <SelectItem value="1st Year">1st Year</SelectItem>
                    <SelectItem value="2nd Year">2nd Year</SelectItem>
                    <SelectItem value="3rd Year">3rd Year</SelectItem>
                    <SelectItem value="4th Year">4th Year</SelectItem>
                    <SelectItem value="5th Year">5th Year</SelectItem>
                    <SelectItem value="1st Year Graduate">1st Year Graduate</SelectItem>
                    <SelectItem value="2nd Year Graduate">2nd Year Graduate</SelectItem>
                    <SelectItem value="3rd Year Graduate">3rd Year Graduate</SelectItem>
                    <SelectItem value="Thesis Writing">Thesis Writing</SelectItem>
                    <SelectItem value="Dissertation Writing">Dissertation Writing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campus
                </label>
                <Select
                  value={filters.campus}
                  onValueChange={(value) => {
                    setFilters((prev) => ({ ...prev, campus: value, entranceId: '' }))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Campuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Campuses</SelectItem>
                    <SelectItem value="COLLEGE">College</SelectItem>
                    <SelectItem value="BASIC_EDUCATION">Basic Education</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Library / Entrance
                </label>
                <Select
                  value={filters.entranceId}
                  onValueChange={(value) => handleFilterChange('entranceId', value)}
                >
                  <SelectTrigger
                    className="w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={visibleEntrances.length === 0}
                  >
                    <SelectValue
                      placeholder={
                        allEntrances.length === 0
                          ? 'No entrances configured'
                          : 'All entrances'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All entrances</SelectItem>
                    {visibleEntrances.map((e) => (
                      <SelectItem
                        key={e.entrance_id}
                        value={String(e.entrance_id)}
                      >
                        {e.name}
                        <span className="ml-1.5 text-[10px] text-gray-500">
                          ({e.campus === 'COLLEGE' ? 'College' : 'Basic Ed'})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <div className="flex items-end">
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md w-full">
                  <div className="flex items-center justify-between">
                    <span>
                      <strong>{entryLogs.length}</strong> entries found
                    </span>
                    {(filters.search || filters.department || filters.office || filters.yearLevel || filters.dateFrom || filters.dateTo || filters.status !== 'all' || filters.campus || filters.entranceId) && (
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
                  <h3 className="text-lg font-semibold text-gray-800">
                    Real-time Entry Logs
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {entryLogs.length} entries · Page {currentPage} of {totalPages || 1}
                    {lastEventAt && (
                      <span className="ml-2 text-xs text-gray-400">
                        · Updated {lastEventAt.toLocaleTimeString()}
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
                      Library
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm text-gray-500 mb-2">No entry logs found</p>
                          <p className="text-xs text-gray-400">
                            {filters.search || filters.department || filters.office || filters.yearLevel || filters.dateFrom || filters.dateTo || filters.status !== 'all' || filters.campus || filters.entranceId
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
                              ID: {log.user?.account_id || log.user_id} · {log.user?.user_type || 'Loading...'}
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
                          {(() => {
                            // Year level is stored in two
                            // different places depending on
                            // education level:
                            //   - COLLEGE / staff / alumni /
                            //     guests: `user.year_level`
                            //     (free-text string)
                            //   - BASIC_EDUCATION: the year
                            //     is on `user.grade_level_id`
                            //     and the human-readable name
                            //     is on the joined
                            //     `user.grade_level` row
                            // Fall back through both, then to
                            // N/A so the cell is never blank
                            // for a student that just doesn't
                            // have a year set yet.
                            const u = log.user as any
                            const fromGradeLevel = u?.grade_level?.name as
                              | string
                              | undefined
                            const fromYearLevel = u?.year_level as
                              | string
                              | undefined
                            const value = fromGradeLevel || fromYearLevel
                            return (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {value || 'N/A'}
                              </span>
                            )
                          })()}
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
                          {log.entrance?.name ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-indigo-50 text-indigo-700 w-fit">
                                <i className="fas fa-door-closed text-[10px]"></i>
                                {log.entrance.name}
                              </span>
                              {log.entrance.campus && (
                                <span className="text-[10px] text-gray-500">
                                  {log.entrance.campus === 'COLLEGE' ? 'College' : 'Basic Ed'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
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
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>Previous</Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                        return (
                          <Button key={pageNum} variant={pageNum === currentPage ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(pageNum)} className="w-8 h-8 p-0">
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Next</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          filters={analyticsFilters}
          setFilters={setAnalyticsFilters}
          applyDatePreset={applyDatePreset}
          allEntrances={allEntrances}
          visibleEntrances={visibleAnalyticsEntrances}
          departments={departments}
          programs={programs}
          gradeLevels={gradeLevels}
          loading={analyticsLoading}
          data={analytics}
        />
      )}
    </div>
  );
}

// ============================================================
// Analytics Tab
// ------------------------------------------------------------
// Self-contained component so the comprehensive
// filterable analytics view stays out of the way of
// the (much larger) AdminView. Renders five pieces:
//
//   1. Filter bar    — date preset chips, custom
//                      date range, campus, entrance,
//                      user type, department, program,
//                      grade level. Bucket size is
//                      auto-derived from the range.
//   2. Summary cards — total entries, unique users,
//                      currently inside, peak bucket.
//   3. Trend chart   — main entries-vs-exits line.
//                      Switches to per-campus series
//                      when "All campuses" is selected
//                      and to per-entrance series when
//                      "All entrances" is selected.
//   4. Smart chart grid — breakdowns by campus,
//                      entrance, user type, department,
//                      program, grade level, year level,
//                      purpose.
//   5. Heatmaps      — hour-of-day and day-of-week
//                      intensity grids.
// ============================================================
function AnalyticsTab({
  filters,
  setFilters,
  applyDatePreset,
  allEntrances,
  visibleEntrances,
  departments,
  programs,
  gradeLevels,
  loading,
  data
}: {
  filters: {
    preset: DatePreset
    dateFrom: string
    dateTo: string
    campus: '' | 'COLLEGE' | 'BASIC_EDUCATION'
    entranceId: string
    userType: '' | 'STUDENT' | 'EMPLOYEE' | 'ALUMNI' | 'GUEST'
    departmentId: string
    programId: string
    gradeLevelId: string
  }
  setFilters: React.Dispatch<React.SetStateAction<typeof filters>>
  applyDatePreset: (preset: DatePreset) => void
  allEntrances: Entrance[]
  visibleEntrances: Entrance[]
  departments: any[]
  programs: any[]
  gradeLevels: any[]
  loading: boolean
  data: AnalyticsPayload | null
}) {
  const selectedEntrance: Entrance | null = useMemo(() => {
    if (!filters.entranceId) return null
    return allEntrances.find((e) => String(e.entrance_id) === filters.entranceId) || null
  }, [filters.entranceId, allEntrances])

  const visiblePrograms = useMemo(() => {
    if (!filters.departmentId) return programs
    return programs.filter(
      (p: any) => String(p.department_id ?? p.department?.department_id) === filters.departmentId
    )
  }, [programs, filters.departmentId])

  const showEntranceDetail = !!selectedEntrance
  const showByEntranceChart = !showEntranceDetail
  const showByCampusChart = !filters.campus
  const showCampusComparison = !filters.campus && (data?.campusSeries?.length ?? 0) > 0
  const showEntranceComparison =
    !filters.entranceId && (data?.entranceSeries?.length ?? 0) > 0

  const truncate = (s: string, n: number) =>
    s.length > n ? s.substring(0, n) + '…' : s

  const activeFilterChips: Array<{ key: string; label: string; onClear?: () => void }> = []
  if (filters.campus) {
    activeFilterChips.push({
      key: 'campus',
      label: filters.campus === 'COLLEGE' ? 'College' : 'Basic Ed',
      onClear: () => setFilters((p) => ({ ...p, campus: '', entranceId: '' }))
    })
  }
  if (filters.entranceId && selectedEntrance) {
    activeFilterChips.push({
      key: 'entrance',
      label: selectedEntrance.name,
      onClear: () => setFilters((p) => ({ ...p, entranceId: '' }))
    })
  }
  if (filters.userType) {
    activeFilterChips.push({
      key: 'userType',
      label: filters.userType.charAt(0) + filters.userType.slice(1).toLowerCase(),
      onClear: () => setFilters((p) => ({ ...p, userType: '' }))
    })
  }
  if (filters.departmentId) {
    const dept = departments.find((d: any) => String(d.department_id) === filters.departmentId)
    activeFilterChips.push({
      key: 'department',
      label: dept?.name || 'Department',
      onClear: () => setFilters((p) => ({ ...p, departmentId: '', programId: '' }))
    })
  }
  if (filters.programId) {
    const prog = programs.find((p: any) => String(p.program_id) === filters.programId)
    activeFilterChips.push({
      key: 'program',
      label: prog?.name || 'Program',
      onClear: () => setFilters((p) => ({ ...p, programId: '' }))
    })
  }
  if (filters.gradeLevelId) {
    const gl = gradeLevels.find((g: any) => String(g.grade_level_id) === filters.gradeLevelId)
    activeFilterChips.push({
      key: 'gradeLevel',
      label: gl?.name || 'Grade level',
      onClear: () => setFilters((p) => ({ ...p, gradeLevelId: '' }))
    })
  }

  const presetChips: Array<[DatePreset, string]> = [
    ['today', 'Today'],
    ['yesterday', 'Yesterday'],
    ['thisWeek', 'This Week'],
    ['thisMonth', 'This Month'],
    ['last7', 'Last 7d'],
    ['last30', 'Last 30d'],
    ['last90', 'Last 90d'],
    ['thisYear', 'This Year'],
    ['last365', 'Last 365d'],
    ['custom', 'Custom']
  ]

  return (
    <div className="py-4 space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <i className="fas fa-filter text-blue-600"></i>
              Library Access Report
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap mb-3">
          <span className="text-gray-500">Date preset:</span>
          <div className="flex flex-wrap gap-1">
            {presetChips.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyDatePreset(value)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  filters.preset === value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">From</label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value, preset: 'custom' }))} className="w-full" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">To</label>
            <Input type="date" value={filters.dateTo} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value, preset: 'custom' }))} className="w-full" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">Campus</label>
            <Select value={filters.campus} onValueChange={(v) => setFilters((p) => ({ ...p, campus: v as any, entranceId: '' }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All campuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All campuses</SelectItem>
                <SelectItem value="COLLEGE">College</SelectItem>
                <SelectItem value="BASIC_EDUCATION">Basic Education</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">Library / Entrance</label>
            <Select value={filters.entranceId} onValueChange={(v) => setFilters((p) => ({ ...p, entranceId: v }))}>
              <SelectTrigger className="w-full disabled:opacity-60 disabled:cursor-not-allowed" disabled={visibleEntrances.length === 0}>
                <SelectValue placeholder={allEntrances.length === 0 ? 'No entrances configured' : 'All entrances'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All entrances</SelectItem>
                {visibleEntrances.map((e) => (
                  <SelectItem key={e.entrance_id} value={String(e.entrance_id)}>
                    {e.name}<span className="ml-1.5 text-[10px] text-gray-500">({e.campus === 'COLLEGE' ? 'College' : 'Basic Ed'})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">User type</label>
            <Select value={filters.userType} onValueChange={(v) => setFilters((p) => ({ ...p, userType: v as any }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All user types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All user types</SelectItem>
                <SelectItem value="STUDENT">Student</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="ALUMNI">Alumni</SelectItem>
                <SelectItem value="GUEST">Guest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">Department</label>
            <Select value={filters.departmentId} onValueChange={(v) => setFilters((p) => ({ ...p, departmentId: v, programId: '' }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All departments</SelectItem>
                {departments.map((d: any) => (
                  <SelectItem key={d.department_id} value={String(d.department_id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">Program</label>
            <Select value={filters.programId} onValueChange={(v) => setFilters((p) => ({ ...p, programId: v }))}>
              <SelectTrigger className="w-full disabled:opacity-60 disabled:cursor-not-allowed" disabled={visiblePrograms.length === 0}><SelectValue placeholder={visiblePrograms.length === 0 ? 'No programs' : 'All programs'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All programs</SelectItem>
                {visiblePrograms.map((p: any) => (
                  <SelectItem key={p.program_id} value={String(p.program_id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">Grade level</label>
            <Select value={filters.gradeLevelId} onValueChange={(v) => setFilters((p) => ({ ...p, gradeLevelId: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All grade levels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All grade levels</SelectItem>
                {gradeLevels.map((g: any) => (
                  <SelectItem key={g.grade_level_id} value={String(g.grade_level_id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(activeFilterChips.length > 0 || filters.preset !== 'today') && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Active:</span>
            {filters.preset !== 'today' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                <i className="fas fa-calendar text-[10px]"></i>
                {filters.dateFrom === filters.dateTo ? filters.dateFrom : `${filters.dateFrom} → ${filters.dateTo}`}
                <button type="button" onClick={() => applyDatePreset('today')} className="ml-1 hover:text-blue-900" title="Reset to Today">
                  <i className="fas fa-times text-[10px]"></i>
                </button>
              </span>
            )}
            {activeFilterChips.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                <span className="font-medium">{c.label}</span>
                {c.onClear && (
                  <button type="button" onClick={c.onClear} className="ml-1 hover:text-red-600" title={`Clear ${c.label} filter`}>
                    <i className="fas fa-times text-[10px]"></i>
                  </button>
                )}
              </span>
            ))}
            <Button type="button" variant="outline" size="sm"
              onClick={() => {
                setFilters((p) => ({ ...p, campus: '', entranceId: '', userType: '', departmentId: '', programId: '', gradeLevelId: '' }))
                applyDatePreset('today')
              }}
              className="h-7 text-xs ml-auto"
            >
              <i className="fas fa-rotate-left mr-1"></i>Reset
            </Button>
          </div>
        )}
      </Card>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-gray-600 mt-2">Loading analytics…</p>
          </div>
        </div>
      ) : !data ? (
        <Card className="p-10 text-center">
          <i className="fas fa-exclamation-triangle text-4xl text-gray-300 mb-4"></i>
          <p className="text-sm text-gray-600 mb-2">Analytics data unavailable</p>
          <p className="text-xs text-gray-500 mb-4">The server didn&apos;t return any data for this scope. Try widening the date range.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Total Entries</h3>
                  <div className="text-2xl font-bold text-green-600">{data.summary.totalEntries.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{data.summary.totalExits.toLocaleString()} exited · {data.summary.uniqueUsers.toLocaleString()} unique</div>
                </div>
                <i className="fas fa-door-open text-3xl text-green-200"></i>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Unique Users</h3>
                  <div className="text-2xl font-bold text-blue-600">{data.summary.uniqueUsers.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Distinct library visitors</div>
                </div>
                <i className="fas fa-users text-3xl text-blue-200"></i>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Currently Inside</h3>
                  <div className="text-2xl font-bold text-orange-600">{data.summary.currentlyInside.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Open sessions right now</div>
                </div>
                <i className="fas fa-user-check text-3xl text-orange-200"></i>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">
                    {data.summary.interval === 'hour' ? 'Peak Hour' : data.summary.interval === 'day' ? 'Peak Day' : data.summary.interval === 'week' ? 'Peak Week' : 'Peak Month'}
                  </h3>
                  <div className="text-2xl font-bold text-purple-600">{data.summary.peakBucket?.label || 'N/A'}</div>
                  <div className="text-xs text-gray-500">{data.summary.peakBucket?.entries ? `${data.summary.peakBucket.entries.toLocaleString()} entries` : 'Busiest bucket'}</div>
                </div>
                <i className="fas fa-chart-line text-3xl text-purple-200"></i>
              </div>
            </Card>
          </div>

          {!showCampusComparison && !showEntranceComparison && (
            <Card className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-wave-square text-blue-500"></i>Entry trend
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {data.summary.interval === 'hour'
                      ? 'Hourly entries and exits for the selected day'
                      : data.summary.interval === 'day'
                        ? 'Daily entries and exits for the selected range'
                        : data.summary.interval === 'week'
                          ? `Weekly entries for the selected range · ${data.summary.daySpan} day span`
                          : `Monthly entries for the selected range · ${data.summary.daySpan} day span`}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium uppercase tracking-wide">{data.summary.interval} buckets</span>
              </div>
              <div className="h-80">
                <LineChart
                  data={data.trend.map((p) => ({ name: p.label, entries: p.entries, exits: p.exits }))}
                  lines={[
                    { dataKey: 'entries', stroke: '#3b82f6', name: 'Entries' },
                    { dataKey: 'exits', stroke: '#10b981', name: 'Exits' }
                  ]}
                  height={320}
                  emptyMessage="No entries were recorded for this period. Try widening the date range or clearing some filters."
                />
              </div>
            </Card>
          )}

          {showCampusComparison && (
            <Card className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-graduation-cap text-blue-500"></i>Entries by Campus
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Per-{data.summary.interval} entries for each campus so you can compare them side-by-side.</p>
                </div>
                <span className="text-xs text-gray-500">{data.campusSeries.length} {data.campusSeries.length === 1 ? 'campus' : 'campuses'}</span>
              </div>
              <div className="h-80">
                <LineChart
                  data={data.trend.map((p, idx) => {
                    const row: any = { name: p.label }
                    for (const s of data.campusSeries) { row[s.name] = s.data[idx]?.entries ?? 0 }
                    return row
                  })}
                  lines={data.campusSeries.map((s) => ({ dataKey: s.name, stroke: (s as any).stroke || '#3b82f6', name: s.name }))}
                  height={320}
                  emptyMessage="No campus activity in this period. Try widening the date range."
                />
              </div>
            </Card>
          )}

          {showEntranceComparison && (
            <Card className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-door-closed text-indigo-500"></i>Entries by Library / Entrance
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Per-{data.summary.interval} entries for each library so you can compare foot traffic between them.</p>
                </div>
                <span className="text-xs text-gray-500">{data.entranceSeries.length} {data.entranceSeries.length === 1 ? 'entrance' : 'entrances'}</span>
              </div>
              <div className="h-80">
                <LineChart
                  data={data.trend.map((p, idx) => {
                    const row: any = { name: p.label }
                    for (const s of data.entranceSeries) {
                      const shortName = s.name.length > 20 ? s.name.substring(0, 20) + '…' : s.name
                      row[shortName] = s.data[idx]?.entries ?? 0
                    }
                    return row
                  })}
                  lines={data.entranceSeries.map((s, i) => {
                    const palette = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899']
                    const shortName = s.name.length > 20 ? s.name.substring(0, 20) + '…' : s.name
                    return { dataKey: shortName, stroke: palette[i % palette.length], name: `${s.name}${s.campus ? ` (${s.campus === 'COLLEGE' ? 'College' : 'Basic Ed'})` : ''}` }
                  })}
                  height={320}
                  emptyMessage="No library entries in this period. Try widening the date range."
                />
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {showByCampusChart && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-graduation-cap text-blue-500"></i>Total entries by Campus
                  </h3>
                  <span className="text-xs text-gray-500">Comparison</span>
                </div>
                <div className="h-64">
                  <BarChart
                    data={data.breakdowns.byCampus.map((b) => ({ name: b.campus === 'COLLEGE' ? 'College' : 'Basic Ed', entries: b.entries }))}
                    bars={[{ dataKey: 'entries', fill: '#3b82f6', name: 'Entries' }]}
                    height={250}
                    emptyMessage="No campus activity in this period."
                  />
                </div>
              </Card>
            )}

            {showByEntranceChart && (
              <Card className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-door-closed text-indigo-500"></i>Total entries by Library
                  </h3>
                  <span className="text-xs text-gray-500">{filters.campus ? (filters.campus === 'COLLEGE' ? 'College campus' : 'Basic Ed campus') : 'All campuses'}</span>
                </div>
                <div className="h-64">
                  <BarChart
                    data={data.breakdowns.byEntrance.map((b) => ({ name: truncate(b.name, 20), entries: b.entries }))}
                    bars={[{ dataKey: 'entries', fill: '#6366f1', name: 'Entries' }]}
                    height={250}
                    rotateLabels
                    emptyMessage="No entrance activity in this period. Try widening the date range or picking a different campus."
                  />
                </div>
              </Card>
            )}

            {showEntranceDetail && selectedEntrance && (
              <Card className="p-6 xl:col-span-2">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <i className="fas fa-door-closed text-indigo-500"></i>
                      {selectedEntrance.name}
                      <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${selectedEntrance.campus === 'COLLEGE' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                        {selectedEntrance.campus === 'COLLEGE' ? 'College' : 'Basic Ed'}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Per-{data.summary.interval} entries vs exits for this single library in the selected range</p>
                  </div>
                </div>
                <div className="h-64">
                  <LineChart
                    data={data.trend.map((p) => ({ name: p.label, entries: p.entries, exits: p.exits }))}
                    lines={[
                      { dataKey: 'entries', stroke: '#6366f1', name: 'Entries' },
                      { dataKey: 'exits', stroke: '#10b981', name: 'Exits' }
                    ]}
                    height={250}
                    emptyMessage="No entries for this entrance. Try a wider date range."
                  />
                </div>
              </Card>
            )}

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <i className="fas fa-user-graduate text-purple-500"></i>Entries by User Type
                </h3>
                <span className="text-xs text-gray-500">Breakdown</span>
              </div>
              <div className="h-64">
                <BarChart
                  data={data.breakdowns.byUserType.map((b) => ({ name: b.userType.charAt(0) + b.userType.slice(1).toLowerCase(), entries: b.entries }))}
                  bars={[{ dataKey: 'entries', fill: '#8b5cf6', name: 'Entries' }]}
                  height={250}
                  emptyMessage="No user-type data in this period."
                />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <i className="fas fa-building text-emerald-500"></i>Entries by Department
                </h3>
                <span className="text-xs text-gray-500">Top departments</span>
              </div>
              <div className="h-64">
                <BarChart
                  data={data.breakdowns.byDepartment.slice(0, 12).map((b) => ({ name: truncate(b.department, 16), entries: b.entries }))}
                  bars={[{ dataKey: 'entries', fill: '#10b981', name: 'Entries' }]}
                  height={250}
                  rotateLabels
                  emptyMessage="No department data in this period."
                />
              </div>
            </Card>

            {data.breakdowns.byProgram.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-graduation-cap text-teal-500"></i>Entries by Program
                  </h3>
                  <span className="text-xs text-gray-500">Top programs</span>
                </div>
                <div className="h-64">
                  <BarChart
                    data={data.breakdowns.byProgram.slice(0, 12).map((b) => ({ name: truncate(b.program, 16), entries: b.entries }))}
                    bars={[{ dataKey: 'entries', fill: '#14b8a6', name: 'Entries' }]}
                    height={250}
                    rotateLabels
                    emptyMessage="No program data in this period."
                  />
                </div>
              </Card>
            )}

            {data.breakdowns.byGradeLevel.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-layer-group text-cyan-500"></i>Entries by Grade Level
                  </h3>
                  <span className="text-xs text-gray-500">Breakdown</span>
                </div>
                <div className="h-64">
                  <BarChart
                    data={data.breakdowns.byGradeLevel.slice(0, 12).map((b) => ({ name: truncate(b.gradeLevel, 16), entries: b.entries }))}
                    bars={[{ dataKey: 'entries', fill: '#06b6d4', name: 'Entries' }]}
                    height={250}
                    rotateLabels
                    emptyMessage="No grade-level data in this period."
                  />
                </div>
              </Card>
            )}

            {data.breakdowns.byYearLevel.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-bookmark text-rose-500"></i>Entries by Year Level
                  </h3>
                  <span className="text-xs text-gray-500">Breakdown</span>
                </div>
                <div className="h-64">
                  <BarChart
                    data={data.breakdowns.byYearLevel.slice(0, 12).map((b) => ({ name: truncate(b.yearLevel, 16), entries: b.entries }))}
                    bars={[{ dataKey: 'entries', fill: '#f43f5e', name: 'Entries' }]}
                    height={250}
                    rotateLabels
                    emptyMessage="No year-level data in this period."
                  />
                </div>
              </Card>
            )}

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <i className="fas fa-bullseye text-amber-500"></i>Entries by Purpose
                </h3>
                <span className="text-xs text-gray-500">Visit intent</span>
              </div>
              <div className="h-64">
                <BarChart
                  data={data.breakdowns.byPurpose.slice(0, 10).map((b) => ({ name: truncate(b.purpose, 18), entries: b.entries }))}
                  bars={[{ dataKey: 'entries', fill: '#f59e0b', name: 'Entries' }]}
                  height={250}
                  rotateLabels
                  emptyMessage="No purpose data in this period."
                />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-clock text-rose-500"></i>Hour-of-day activity
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Total entries per clock hour across the selected range. Darker cells = more visits.</p>
                </div>
              </div>
              <Heatmap
                data={(data.heatmaps?.hourOfDay ?? []).map((c) => ({ label: c.label, entries: c.entries }))}
                caption="00:00 → 23:00 (PH wall-clock)"
                emptyMessage="No hourly activity in this period."
              />
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-calendar-week text-violet-500"></i>Day-of-week activity
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Total entries per weekday across the selected range. Darker cells = more visits.</p>
                </div>
              </div>
              <Heatmap
                data={(data.heatmaps?.dayOfWeek ?? []).map((c) => ({ label: c.label, entries: c.entries }))}
                caption="Mon → Sun"
                emptyMessage="No weekday activity in this period."
              />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
