"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { NotificationService } from '@/lib/notification';

interface EntryLog {
  entry_id: number;
  entry_time: string;
  exit_time: string | null;
  user_id: number;
  rfid_code?: string | null;
  purpose?: string | null;
  verified_by?: number | null;
  /** Stamped at write time from the verifying staff's campus. */
  campus?: 'COLLEGE' | 'BASIC_EDUCATION' | null;
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

interface StaffViewProps {
  className?: string;
}

export default function StaffView({ className }: StaffViewProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recentEntries, setRecentEntries] = useState<EntryLog[]>([]);
  const [recentEntriesSearch, setRecentEntriesSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastSuccessfulEntry, setLastSuccessfulEntry] = useState<string | null>(null);

  // The staff's CURRENT campus designation. The /api/entry-logs GET is
  // already auto-scoped server-side, so this is purely a UI affordance:
  // it drives the banner, the SSE filter, and the recent-entries list
  // (so we never show toasts for events from the other campus).
  const [myCampus, setMyCampus] = useState<'COLLEGE' | 'BASIC_EDUCATION' | null>(null);
  const [myCampusLoaded, setMyCampusLoaded] = useState(false);
  
  // Refs for input fields to manage focus
  const userIdInputRef = useRef<HTMLInputElement>(null);
  const rfidInputRef = useRef<HTMLInputElement>(null);

  // Fullscreen mode: hides the app shell (sidebar + header) and forces the
  // browser into fullscreen so staff can keep their focus on logging entries.
  // The state is driven entirely by the `fullscreenchange` event so there's
  // no chance of toggling state out of sync with what the browser is doing.
  const [isFullscreen, setIsFullscreen] = useState(false);

  const emitFullscreenChange = useCallback((active: boolean) => {
    if (typeof window === 'undefined') return;
    if (active) {
      document.body.classList.add('entry-monitoring-fullscreen');
    } else {
      document.body.classList.remove('entry-monitoring-fullscreen');
    }
    window.dispatchEvent(
      new CustomEvent('entry-monitoring-fullscreen-changed', { detail: { active } })
    );
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        // The fullscreenchange listener will sync state; no need to set here.
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen toggle failed:', err);
      await NotificationService.error(
        'Fullscreen Unavailable',
        'Your browser blocked the fullscreen request. Please try again or check browser permissions.'
      );
    }
  }, []);

  // Keep local state in sync with the actual fullscreen state. Mounted once;
  // the listener handles both programmatic toggles and Esc / browser exits.
  useEffect(() => {
    const onFsChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      emitFullscreenChange(active);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      // Clean up our fullscreen state when this view unmounts. Otherwise
      // the body class would survive navigation to e.g. /entry-monitoring/logs
      // and our CSS would lock the next page to the viewport (overflow hidden,
      // height: 100vh) -- making it unscrollable.
      if (document.body.classList.contains('entry-monitoring-fullscreen')) {
        document.body.classList.remove('entry-monitoring-fullscreen');
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        emitFullscreenChange(false);
      }
    };
  }, [emitFullscreenChange]);

  // Form state
  const [formData, setFormData] = useState({
    user_id: '',
    rfid_code: '',
    full_name: '',
    role: '',
    year_level: '',
    department: '',
    purpose: ''
  });

  // Scan priority: which identification field is the
  // primary input the staff member uses day-to-day.
  // 'rfid' = RFID scanner (default), 'userId' = manual
  // User ID entry. Stored in localStorage so the
  // preference sticks across sessions.
  const SCAN_PRIORITY_KEY = 'entry-monitoring.scan-priority'
  const [scanPriority, setScanPriorityState] = useState<'rfid' | 'userId'>(
    () => {
      if (typeof window === 'undefined') return 'rfid'
      try {
        const stored = window.localStorage.getItem(SCAN_PRIORITY_KEY)
        if (stored === 'userId' || stored === 'rfid') return stored
      } catch {
        /* localStorage may be blocked */
      }
      return 'rfid'
    }
  )

  const setScanPriority = useCallback(
    (next: 'rfid' | 'userId') => {
      setScanPriorityState(next)
      try {
        window.localStorage.setItem(SCAN_PRIORITY_KEY, next)
      } catch {
        /* ignore storage errors */
      }
      // Move focus to the new priority field so the
      // user can keep typing without clicking.
      requestAnimationFrame(() => {
        if (next === 'rfid') {
          rfidInputRef.current?.focus()
        } else {
          userIdInputRef.current?.focus()
        }
      })
    },
    []
  )

  // Settings menu: toggled by the gear button next to
  // the fullscreen control. Closed automatically when
  // the user clicks anywhere outside of it.
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const priorityMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showPriorityMenu) return
    const onDocClick = (e: MouseEvent) => {
      if (
        priorityMenuRef.current &&
        !priorityMenuRef.current.contains(e.target as Node)
      ) {
        setShowPriorityMenu(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPriorityMenu(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [showPriorityMenu])

  // Fetch recent entries
  const fetchRecentEntries = useCallback(async () => {
    try {
      const response = await fetch('/api/entry-logs?limit=10&include_user=true', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const logs = (data && (data.data?.logs ?? data.logs)) || [];
        setRecentEntries(logs);
        setLastUpdated(new Date());
        console.log('Recent entries fetched:', logs.length); // Debug log
      }
    } catch (error) {
      console.error('Error fetching recent entries:', error);
    }
  }, []);

  // Load recent entries on mount
  useEffect(() => {
    fetchRecentEntries();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRecentEntries, 30000);
    
    // Add keyboard shortcut for clearing form (Ctrl+R or Esc)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        clearForm();
        // Re-focus the priority field so the user can
        // immediately start the next scan.
        if (scanPriority === 'userId') {
          userIdInputRef.current?.focus();
        } else {
          rfidInputRef.current?.focus();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchRecentEntries, scanPriority]);

  // Auto-focus the priority field on component mount so
  // the first input lands on whichever field the staff
  // member is most likely to use.
  useEffect(() => {
    // Delay focus slightly to ensure component is fully mounted
    const timer = setTimeout(() => {
      if (scanPriority === 'userId') {
        userIdInputRef.current?.focus();
      } else {
        rfidInputRef.current?.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [scanPriority]);


  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/staff/me/campus', {
          credentials: 'include',
          headers: { 'Cache-Control': 'no-store' }
        })
        if (!res.ok) {
          setMyCampusLoaded(true)
          return
        }
        const body = await res.json()
        if (cancelled) return
        if (body?.campus === 'COLLEGE' || body?.campus === 'BASIC_EDUCATION') {
          setMyCampus(body.campus)
        }
        setMyCampusLoaded(true)
      } catch {
        if (!cancelled) setMyCampusLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const recentEntriesArray: EntryLog[] = Array.isArray(recentEntries) ? recentEntries : [];
  const normalizedRecentEntriesSearch = recentEntriesSearch.trim().toLowerCase();
  const filteredRecentEntries = normalizedRecentEntriesSearch
    ? recentEntriesArray.filter((entry) => {
        if (!entry || typeof entry !== 'object') return false;

        const searchableParts = [
          entry.user?.full_name,
          entry.user?.account_id,
          typeof entry.user_id === 'number' ? String(entry.user_id) : undefined,
          entry.rfid_code ?? undefined,
          entry.user?.department_ref?.name,
          entry.user?.program?.name,
          entry.purpose ?? undefined,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        return searchableParts.some((part) => part.includes(normalizedRecentEntriesSearch));
      })
    : recentEntriesArray;

  // Cap the number of recent entries shown in the side panel: 3 in normal
  // view, 4 in fullscreen (more vertical space is available).
  const displayLimit = isFullscreen ? 4 : 3;
  const displayedRecentEntries = filteredRecentEntries.slice(0, displayLimit);

  // Real-time updates via Server-Sent Events (SSE)
  useEffect(() => {
    const source = new EventSource('/api/entry-logs/stream');
    source.onmessage = (event) => {
      if (!event.data) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'entry-log' && data.payload) {
          const payload = data.payload;
          // Drop events from the other campus so a STAFF only ever sees
          // their own campus in the live stream. The server already
          // scopes /api/entry-logs reads the same way; this is the
          // toast / recent-list counterpart.
          if (myCampus && payload.campus && payload.campus !== myCampus) {
            return
          }
          setRecentEntries(prev => {
            const next = [payload, ...prev];
            return next.slice(0, 10);
          });
          setLastUpdated(new Date());
        }
      } catch (_) {
        // ignore parse errors
      }
    };
    source.onerror = () => {
      // Attempt simple reconnect by closing; browser will retry automatically for EventSource
      source.close();
      // Fallback fetch to ensure UI not stale
      fetchRecentEntries();
    };
    return () => source.close();
  }, [fetchRecentEntries, myCampus]);

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle Enter key press for fast RFID entry
  const handleKeyPress = (e: React.KeyboardEvent, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'rfid_code' && formData.rfid_code) {
        // Auto-submit on RFID Enter if we have data
        handleSubmit(e as any);
      } else if (field === 'user_id' && formData.user_id) {
        // Auto-submit on User ID Enter if we have data  
        handleSubmit(e as any);
      }
    }
  };

  // Validate user exists
  const validateUser = async (userId: string, rfidCode: string) => {
    try {
      let response;
      
      if (userId) {
        // Use fast RESTful endpoint for account_id
        response = await fetch(`/api/staff/users/${encodeURIComponent(userId)}`, {
          credentials: 'include'
        });
      } else {
        // Use fast RESTful endpoint for RFID
        response = await fetch(`/api/staff/users/rfid/${encodeURIComponent(rfidCode)}`, {
          credentials: 'include'
        });
      }
      
      if (response.ok) {
        const payload = await response.json();
        const user = (payload && (payload.data?.user ?? payload.user)) || null;
        const found = (payload && (payload.data?.found ?? payload.found)) ?? !!user;
        return found && user ? user : null;
      }
      return null;
    } catch (error) {
      console.error('Error validating user:', error);
      return null;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.user_id && !formData.rfid_code) {
      NotificationService.warning(
        'Missing Information',
        'Please enter either User ID or RFID Code to log an entry.'
      );
      return;
    }
    
    setSubmitting(true);
    
    try {
      // First, validate if user exists
      const user = await validateUser(formData.user_id, formData.rfid_code);
      
      if (!user) {
        // Show SweetAlert2 error for non-existent user
        await NotificationService.error(
          'User Not Found',
          formData.user_id 
            ? `No user found with ID: ${formData.user_id}`
            : `No user found with RFID: ${formData.rfid_code}`
        );
        setSubmitting(false);
        return;
      }
      
      // If user is inactive, show centered modal and block logging
      if (user.status !== 'ACTIVE') {
        await NotificationService.error(
          'Account Inactive',
          `${user.full_name} your account is inactive, please please proceed library office.`
        );
        setSubmitting(false);
        return;
      }
      
      // User exists and is ACTIVE, proceed with entry logging using numeric user_id from lookup
      const response = await fetch('/api/entry-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.user_id, // use numeric primary key
          rfid_code: formData.rfid_code || undefined,
          purpose: formData.purpose || 'General'
        })
      });
      
      if (response.ok) {
        // Store success info for visual feedback without blocking
        setLastSuccessfulEntry(`${user.full_name} (${user.account_id}) logged successfully`);
        
        // Clear the success message after 3 seconds
        setTimeout(() => {
          setLastSuccessfulEntry(null);
        }, 3000);
        
        // Clear form immediately for next user
        setFormData({
          user_id: '',
          rfid_code: '',
          full_name: '',
          role: '',
          year_level: '',
          department: '',
          purpose: ''
        });
        
        // Refresh recent entries without delay for immediate feedback
        fetchRecentEntries();

        // Focus the priority field for the next scan.
        setTimeout(() => {
          if (scanPriority === 'userId') {
            userIdInputRef.current?.focus()
          } else {
            rfidInputRef.current?.focus()
          }
        }, 100);
      } else {
        // Robust error handling: try JSON first, then plain text
        let message = '';
        try {
          const errJson = await response.json();
          message = errJson?.error || errJson?.message || '';
        } catch {
          try {
            message = await response.text();
          } catch {
            message = '';
          }
        }
        await NotificationService.error(
          'Failed to Log Entry',
          message || 'An unexpected error occurred while logging the entry.'
        );
      }
    } catch (error) {
      console.error('Error logging entry:', error);
      await NotificationService.error(
        'Connection Error',
        'Failed to connect to the server. Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Clear form
  const clearForm = () => {
    setFormData({
      user_id: '',
      rfid_code: '',
      full_name: '',
      role: '',
      year_level: '',
      department: '',
      purpose: ''
    });
    // Return focus to the priority field after clearing.
    setTimeout(() => {
      if (scanPriority === 'userId') {
        userIdInputRef.current?.focus()
      } else {
        rfidInputRef.current?.focus()
      }
    }, 50);
  };

  // Auto-fill user info based on ID
  const handleUserIdBlur = async () => {
    if (!formData.user_id) return;
    
    try {
      const response = await fetch(`/api/staff/users/${encodeURIComponent(formData.user_id)}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const payload = await response.json();
        const userResp = (payload && (payload.data?.user ?? payload.user)) || null;
        const found = (payload && (payload.data?.found ?? payload.found)) ?? !!userResp;
        if (found && userResp) {
          setFormData(prev => ({
            ...prev,
            full_name: userResp.full_name,
            role: userResp.user_type,
            year_level: userResp.year_level || '',
            department: userResp.department_name || ''
          }));
          
          // Show toast notification for successful lookup with status warning if inactive
          if (userResp.status !== 'ACTIVE') {
            NotificationService.toast(`Found: ${userResp.full_name} (${userResp.status})`, 'warning');
          } else {
            NotificationService.toast(`Found: ${userResp.full_name}`, 'success');
          }
        } else {
          // Clear form fields if user not found
          setFormData(prev => ({
            ...prev,
            full_name: '',
            role: '',
            year_level: '',
            department: ''
          }));
          
          // Show toast notification for user not found
          NotificationService.toast('User not found', 'warning');
        }
      }
    } catch (error) {
      console.error('Error looking up user:', error);
      NotificationService.toast('Error looking up user', 'error');
    }
  };

  // Auto-fill user info based on RFID
  const handleRfidBlur = async () => {
    if (!formData.rfid_code) return;
    
    try {
      const response = await fetch(`/api/staff/users/rfid/${encodeURIComponent(formData.rfid_code)}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const payload = await response.json();
        const userResp = (payload && (payload.data?.user ?? payload.user)) || null;
        const found = (payload && (payload.data?.found ?? payload.found)) ?? !!userResp;
        if (found && userResp) {
          setFormData(prev => ({
            ...prev,
            full_name: userResp.full_name,
            role: userResp.user_type,
            year_level: userResp.year_level || '',
            department: userResp.department_name || ''
          }));
          
          // Show toast notification for successful lookup with status warning if inactive
          if (userResp.status !== 'ACTIVE') {
            NotificationService.toast(`Found: ${userResp.full_name} (${userResp.status})`, 'warning');
          } else {
            NotificationService.toast(`Found: ${userResp.full_name}`, 'success');
          }
        } else {
          // Clear form fields if user not found
          setFormData(prev => ({
            ...prev,
            full_name: '',
            role: '',
            year_level: '',
            department: ''
          }));
          
          // Show toast notification for user not found
          NotificationService.toast('RFID not found', 'warning');
        }
      }
    } catch (error) {
      console.error('Error looking up user by RFID:', error);
      NotificationService.toast('Error looking up RFID', 'error');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className={`max-w-full h-full flex flex-col ${className ?? ''} entry-monitoring-view`}>
      {/* Fullscreen-only branded header */}
      {isFullscreen && (
        <div className="text-center py-4 shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Divine Word College of Calapan
          </h1>
          <div className="flex items-center justify-center gap-2 my-2">
            <div className="h-px w-10 bg-blue-700" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-700" />
            <div className="h-px w-10 bg-blue-700" />
          </div>
          <p className="text-gray-600 text-sm sm:text-base tracking-wide">
            Library Management System
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1 min-h-0 entry-monitoring-grid">
        {/* Entry Form - Takes 2 columns on extra large screens */}
        <div className="xl:col-span-2 h-full min-h-0">
          <Card className="p-0 h-full flex flex-col overflow-hidden">
            {/* Accent bar to anchor the form as the primary panel */}
            <div className="h-1 bg-blue-700 shrink-0" />

            <div className="p-5 flex-1 min-h-0 flex flex-col">



              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                    <i className="fas fa-user-plus text-sm"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800 leading-tight">
                      Log New Entry
                    </h2>
                    <p className="text-[11px] text-gray-500 leading-tight">
                      {scanPriority === 'userId'
                        ? 'Enter User ID to begin (priority: User ID)'
                        : 'Scan RFID to begin (priority: RFID)'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lastSuccessfulEntry && (
                    <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-1 rounded-md text-sm flex items-center gap-1.5">
                      <i className="fas fa-check-circle"></i>
                      <span className="truncate max-w-[220px]">{lastSuccessfulEntry}</span>
                    </div>
                  )}
                  {/*
                    Scan-priority switcher — a small icon
                    button that toggles between RFID-first
                    and User-ID-first workflows. The choice
                    is persisted in localStorage so the user
                    only has to set it once per device.
                  */}
                  <div className="relative" ref={priorityMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowPriorityMenu((v) => !v)}
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors ${
                        showPriorityMenu
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-gray-800'
                      }`}
                      title="Scan priority settings"
                      aria-label="Scan priority settings"
                      aria-expanded={showPriorityMenu}
                      aria-haspopup="true"
                    >
                      <i className="fas fa-sliders text-sm"></i>
                    </button>
                    {showPriorityMenu && (
                      <div
                        role="menu"
                        className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-30 overflow-hidden"
                      >
                        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                          <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
                            Scan priority
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Which field gets focus & the required marker
                          </p>
                        </div>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={scanPriority === 'rfid'}
                          onClick={() => {
                            setScanPriority('rfid')
                            setShowPriorityMenu(false)
                          }}
                          className={`w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${
                            scanPriority === 'rfid' ? 'bg-blue-50' : ''
                          }`}
                        >
                          <i
                            className={`mt-0.5 w-4 h-4 flex items-center justify-center rounded-full border ${
                              scanPriority === 'rfid'
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-gray-300 bg-white text-transparent'
                            }`}
                          >
                            <i className="fas fa-check text-[9px]"></i>
                          </i>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-800 flex items-center gap-1.5">
                              <i className="fas fa-id-card text-blue-600 text-xs"></i>
                              RFID Code
                            </div>
                            <p className="text-[11px] text-gray-500 leading-tight">
                              Use the RFID scanner as the primary input
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={scanPriority === 'userId'}
                          onClick={() => {
                            setScanPriority('userId')
                            setShowPriorityMenu(false)
                          }}
                          className={`w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${
                            scanPriority === 'userId' ? 'bg-blue-50' : ''
                          }`}
                        >
                          <i
                            className={`mt-0.5 w-4 h-4 flex items-center justify-center rounded-full border ${
                              scanPriority === 'userId'
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-gray-300 bg-white text-transparent'
                            }`}
                          >
                            <i className="fas fa-check text-[9px]"></i>
                          </i>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-800 flex items-center gap-1.5">
                              <i className="fas fa-user text-blue-600 text-xs"></i>
                              User ID
                            </div>
                            <p className="text-[11px] text-gray-500 leading-tight">
                              Type the user ID by hand as the primary input
                            </p>
                          </div>
                        </button>
                        <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50">
                          <p className="text-[10px] text-gray-500 leading-tight">
                            <i className="fas fa-circle-info mr-1"></i>
                            Saved to this device. Clear your browser data to reset.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      isFullscreen
                        ? 'bg-blue-700 text-white border-blue-700 hover:bg-blue-800'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    title={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
                    aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
                  >
                    <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-xs`}></i>
                    <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
                {/* Scrollable fields region. min-h-0 is required so the flex
                    child can actually shrink below its content's natural
                    height; without it the form pushes past the card. */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-5">
                  {/* Section: Identification */}
                  <section>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
                        Identification
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          User ID{' '}
                          {scanPriority === 'userId' && (
                            <span className="text-red-500">*</span>
                          )}
                        </label>
                        <Input
                          ref={userIdInputRef}
                          type="text"
                          value={formData.user_id}
                          onChange={(e) => handleInputChange('user_id', e.target.value)}
                          onBlur={handleUserIdBlur}
                          onKeyPress={(e) => handleKeyPress(e, 'user_id')}
                          placeholder={
                            scanPriority === 'userId'
                              ? 'Enter User ID (primary)'
                              : 'Enter User ID'
                          }
                          disabled={!!formData.rfid_code}
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          RFID Code{' '}
                          {scanPriority === 'rfid' && (
                            <span className="text-red-500">*</span>
                          )}
                        </label>
                        <Input
                          ref={rfidInputRef}
                          type="text"
                          value={formData.rfid_code}
                          onChange={(e) => handleInputChange('rfid_code', e.target.value)}
                          onBlur={handleRfidBlur}
                          onKeyPress={(e) => handleKeyPress(e, 'rfid_code')}
                          placeholder={
                            scanPriority === 'rfid'
                              ? 'Scan or enter RFID (primary)'
                              : 'Scan or enter RFID'
                          }
                          disabled={!!formData.user_id}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Section: Visitor Details */}
                  <section>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
                        Visitor Details
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Full Name
                        </label>
                        <Input
                          type="text"
                          value={formData.full_name}
                          onChange={(e) => handleInputChange('full_name', e.target.value)}
                          placeholder="Auto-filled"
                          className="bg-gray-50"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Role
                        </label>
                        <Input
                          type="text"
                          value={formData.role}
                          placeholder="Auto-filled"
                          className="bg-gray-50"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Year Level
                        </label>
                        <Select
                          value={formData.year_level}
                          onValueChange={(value) => handleInputChange('year_level', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select year level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Select year level</SelectItem>
                            <SelectItem value="1st Year">1st Year</SelectItem>
                            <SelectItem value="2nd Year">2nd Year</SelectItem>
                            <SelectItem value="3rd Year">3rd Year</SelectItem>
                            <SelectItem value="4th Year">4th Year</SelectItem>
                            <SelectItem value="Graduate">Graduate</SelectItem>
                            <SelectItem value="N/A">N/A (Staff/Faculty)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Department
                        </label>
                        <Input
                          type="text"
                          value={formData.department}
                          onChange={(e) => handleInputChange('department', e.target.value)}
                          placeholder="Auto-filled"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Section: Visit Information */}
                  <section>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
                        Visit Information
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Purpose
                      </label>
                      <Select
                        value={formData.purpose}
                        onValueChange={(value) => handleInputChange('purpose', value)}
                        side="top"
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select purpose (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Select purpose</SelectItem>
                          <SelectItem value="Study">Study</SelectItem>
                          <SelectItem value="Research">Research</SelectItem>
                          <SelectItem value="Borrow Books">Borrow Books</SelectItem>
                          <SelectItem value="Return Books">Return Books</SelectItem>
                          <SelectItem value="Meeting">Meeting</SelectItem>
                          <SelectItem value="Event">Event</SelectItem>
                          <SelectItem value="General">General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </section>
                </div>

                {/* Action bar with its own divider so the buttons feel anchored */}
                <div className="flex justify-end gap-2 pt-3 mt-2 border-t border-gray-200 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearForm}
                    disabled={submitting}
                  >
                    Clear
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || (!formData.user_id && !formData.rfid_code)}
                    className="bg-blue-700 hover:bg-blue-800 min-w-[140px] text-white"
                  >
                    {submitting ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Logging...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check mr-1.5"></i>
                        Log Entry
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>

        {/* Recent Entries - Takes 1 column, matches form height */}
        <div className="xl:col-span-1 h-full min-h-0">
          <Card className="p-0 h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 shrink-0 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-white text-gray-600 flex items-center justify-center border border-gray-200">
                  <i className="fas fa-stream text-xs"></i>
                </div>
                <h3 className="text-base font-semibold text-gray-800 flex-1">
                  Recent Entries
                </h3>
                {myCampusLoaded && myCampus && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      myCampus === 'COLLEGE'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                    title="Only entries from this campus are shown"
                  >
                    <i
                      className={`fas ${
                        myCampus === 'COLLEGE' ? 'fa-graduation-cap' : 'fa-school'
                      } text-[9px]`}
                    />
                    {myCampus === 'COLLEGE' ? 'College' : 'Basic Ed'}
                  </span>
                )}
                {lastUpdated && (
                  <span className="text-[11px] text-gray-500 font-mono">
                    {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="relative">
                <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
                <Input
                  value={recentEntriesSearch}
                  onChange={(e) => setRecentEntriesSearch(e.target.value)}
                  placeholder="Search recent entries..."
                  className="h-8 text-sm pl-7"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 p-3 overflow-y-auto bg-white">
              <div className="space-y-2">
                {recentEntriesArray.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center">
                      <i className="fas fa-inbox text-lg"></i>
                    </div>
                    <p className="text-sm font-medium text-gray-500">No recent entries</p>
                    <p className="text-xs mt-1">Entries will appear here as they are logged</p>
                  </div>
                ) : filteredRecentEntries.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <p className="text-sm">No matching entries</p>
                  </div>
                ) : (
                  displayedRecentEntries.map((entry) => {
                    const inside = !entry.exit_time;
                    return (
                      <div
                        key={entry.entry_id}
                        className={`relative bg-white border border-gray-200 border-l-4 ${
                          inside ? 'border-l-blue-500' : 'border-l-gray-300'
                        } rounded-md pl-3 pr-2.5 py-2 hover:border-gray-300 transition-colors`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium text-gray-800 text-sm truncate">
                            {entry.user?.full_name || `User #${entry.user_id}`}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                              inside
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${
                                inside ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                            />
                            {inside ? 'Inside' : 'Exited'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap gap-x-1.5 gap-y-0.5">
                          <span className="font-mono">{entry.user?.account_id || entry.user_id}</span>
                          {entry.user?.department_ref?.name && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span>{entry.user.department_ref.name}</span>
                            </>
                          )}
                          <span className="text-gray-300">•</span>
                          <span className="font-mono">{formatTime(entry.entry_time)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-3 border-t border-gray-200 shrink-0 bg-gray-50">
              <Link href="/entry-monitoring/logs" className="block">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  <i className="fas fa-external-link-alt mr-1.5"></i>
                  View All Entry Logs
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
