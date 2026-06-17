declare global {
  interface Window {
    refreshAdminAccounts?: () => void
    refreshStaffAccounts?: () => void
    refreshDashboard?: () => void
  }
}

export {}
