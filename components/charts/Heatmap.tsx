'use client'

import React from 'react'

interface HeatmapCell {
  label: string
  entries: number
}

interface HeatmapProps {
  data: HeatmapCell[]
  /** Short label shown above the grid (e.g. "Hour of day"). */
  caption?: string
  /** Optional override for the empty-state message. */
  emptyMessage?: string
  /** Tailwind color class for the highest-intensity cells. */
  peakColor?: string
  className?: string
}

/**
 * Lightweight heatmap that doesn't need a chart library. Renders
 * each cell as a coloured tile whose opacity scales with the
 * value relative to the dataset's max. Works for both the
 * hour-of-day (24 cells) and day-of-week (7 cells) heatmaps the
 * analytics tab surfaces.
 */
function Heatmap({
  data,
  caption,
  emptyMessage = 'No data for this period',
  peakColor = 'bg-blue-600',
  className
}: HeatmapProps): React.ReactElement {
  const max = data.reduce((m, d) => Math.max(m, d.entries), 0)
  const total = data.reduce((s, d) => s + d.entries, 0)

  if (total === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-48 text-gray-500 ${className || ''}`}>
        <i className="fas fa-fire text-3xl text-gray-300 mb-2"></i>
        <p className="text-sm font-medium text-gray-700">No activity in this period</p>
        <p className="text-xs text-gray-500 mt-1">{emptyMessage}</p>
      </div>
    )
  }

  // Map value -> tailwind opacity. We use the
  // bg-blue-* palette (50..600) so the tile
  // intensity grows with the value.
  const colorFor = (v: number) => {
    if (max <= 0) return 'bg-gray-100 text-gray-500'
    const r = v / max
    if (r === 0) return 'bg-gray-100 text-gray-500'
    if (r < 0.15) return 'bg-blue-50 text-blue-800'
    if (r < 0.3) return 'bg-blue-100 text-blue-800'
    if (r < 0.45) return 'bg-blue-200 text-blue-900'
    if (r < 0.6) return 'bg-blue-300 text-blue-900'
    if (r < 0.75) return 'bg-blue-400 text-white'
    if (r < 0.9) return 'bg-blue-500 text-white'
    return `${peakColor} text-white`
  }

  return (
    <div className={className}>
      {caption && (
        <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-2">
          {caption}
        </p>
      )}
      <div className="grid grid-cols-7 sm:grid-cols-12 gap-1.5">
        {data.map((cell) => (
          <div
            key={cell.label}
            title={`${cell.label} — ${cell.entries} ${cell.entries === 1 ? 'entry' : 'entries'}`}
            className={`relative h-10 rounded-md flex flex-col items-center justify-center text-[10px] font-medium transition-all hover:scale-105 cursor-default ${colorFor(cell.entries)}`}
          >
            <span className="leading-none">{cell.label}</span>
            {cell.entries > 0 && (
              <span className="leading-none text-[9px] mt-0.5 opacity-80">{cell.entries}</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-gray-500">
        <span>Less</span>
        <span className="w-3 h-3 rounded bg-gray-100"></span>
        <span className="w-3 h-3 rounded bg-blue-100"></span>
        <span className="w-3 h-3 rounded bg-blue-200"></span>
        <span className="w-3 h-3 rounded bg-blue-300"></span>
        <span className="w-3 h-3 rounded bg-blue-400"></span>
        <span className="w-3 h-3 rounded bg-blue-500"></span>
        <span className="w-3 h-3 rounded bg-blue-600"></span>
        <span>More</span>
      </div>
    </div>
  )
}

export default Heatmap
