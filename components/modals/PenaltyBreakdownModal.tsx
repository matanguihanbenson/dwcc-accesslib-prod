'use client'

import React from 'react'

export interface PenaltyBreakdownData {
  borrow_time: string
  due_time: string
  fine_start_time: string
  end_time: string
  grace_period_hours: number
  grace_period_minutes: number
  active_hours: number
  rounded_hours: number
  rate: number
  max_fine: number
  penalty: number
  library_open: number
  library_close: number
}

interface PenaltyBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  data: PenaltyBreakdownData | null
  lockerNumber?: string
  userName?: string
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila'
  })
}

function formatHour(h: number) {
  if (h === 0 || h === 24) return '12 MN'
  if (h === 12) return '12 NN'
  if (h < 12) return `${h} AM`
  return `${h - 12} PM`
}

function formatDuration(hours: number) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0 && m === 0) return '0m'
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function PenaltyBreakdownModal({
  isOpen,
  onClose,
  data,
  lockerNumber,
  userName
}: PenaltyBreakdownModalProps) {
  if (!isOpen || !data) return null

  const freeUseHours = data.grace_period_hours + data.grace_period_minutes / 60

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Penalty Breakdown</h3>
            {lockerNumber && (
              <p className="text-xs text-gray-500 mt-0.5">
                Locker {lockerNumber}{userName ? ` — ${userName}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Timeline */}
          <div className="relative">
            {[
              { label: 'Borrowed', time: data.borrow_time, color: 'bg-blue-500' },
              { label: 'Due', time: data.due_time, color: 'bg-green-500' },
              { label: 'Fine starts', time: data.fine_start_time, color: 'bg-amber-500', note: `+${data.grace_period_minutes}m grace` },
              { label: 'Now / Return', time: data.end_time, color: 'bg-red-500' },
            ].map((step, i, arr) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${step.color}`}></div>
                  {i < arr.length - 1 && <div className="w-px h-6 bg-gray-200 my-0.5"></div>}
                </div>
                <div className="flex-1 flex items-center justify-between pb-1">
                  <div>
                    <span className="text-xs font-medium text-gray-900">{step.label}</span>
                    {step.note && <span className="text-[10px] text-gray-400 ml-1.5">{step.note}</span>}
                  </div>
                  <span className="text-xs text-gray-500">{formatDateTime(step.time)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Calculation */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Free use</span>
              <span className="text-gray-700">{formatDuration(freeUseHours)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Library hours</span>
              <span className="text-gray-700">{formatHour(data.library_open)} – {formatHour(data.library_close)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Active hours</span>
              <span className="text-gray-700 font-mono">{data.active_hours.toFixed(2)}h → {data.rounded_hours}h</span>
            </div>
            <div className="border-t border-gray-200 pt-1.5 flex justify-between text-xs">
              <span className="text-gray-500">Rate</span>
              <span className="text-gray-700 font-mono">₱{data.rate.toFixed(2)}/h</span>
            </div>
          </div>

          {/* Final penalty */}
          <div className="flex items-center justify-between bg-red-50 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-red-700">Total Penalty</span>
            <span className="text-xl font-bold text-red-600">₱{data.penalty.toFixed(2)}</span>
          </div>
          {data.penalty >= data.max_fine && (
            <p className="text-[10px] text-gray-400 text-right -mt-2">
              Capped at max ₱{data.max_fine.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
