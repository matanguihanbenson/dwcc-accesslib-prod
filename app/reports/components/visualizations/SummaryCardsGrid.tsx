'use client'

import { SummaryCard } from '../common/SummaryCard'

export interface SummaryCardData {
  title: string
  value: string | number
  description?: string
  icon?: string
  valueColor?: string
}

interface SummaryCardsGridProps {
  cards: SummaryCardData[]
  columns?: number
}

export function SummaryCardsGrid({ cards, columns = 3 }: SummaryCardsGridProps) {
  const gridClass = columns === 3 ? 'md:grid-cols-3' : columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-2'
  
  return (
    <div className={`grid grid-cols-1 ${gridClass} gap-4`}>
      {cards.map((card, index) => (
        <SummaryCard key={index} {...card} />
      ))}
    </div>
  )
}
