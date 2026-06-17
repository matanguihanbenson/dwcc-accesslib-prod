"use client";
import React from "react";
import { useSession } from "next-auth/react";
import { UserRole } from "@/types";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import AdminView from "./components/AdminView";
import StaffView from "./components/StaffView";

function EntryMonitoring() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600">Please log in to access entry monitoring.</p>
        </div>
      </div>
    );
  }

  const userRole = session.user.role as UserRole;
  const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b entry-monitoring-page-header shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {isAdmin ? "Entry Monitoring & Analytics" : "Entry Management"}
                </h1>
                <p className="text-gray-600 mt-1">
                  {isAdmin
                    ? "Real-time entry tracking with advanced analytics and filtering"
                    : "Log and track library visitor entries"
                  }
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl py-6 entry-monitoring-content flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Render appropriate view based on user role */}
        {isAdmin ? (
          <AdminView />
        ) : (
          <StaffView />
        )}
      </div>
    </div>
  );
}

export default EntryMonitoring;
           