'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

const swrConfig = {
  refreshInterval: 0,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  keepPreviousData: true,
  onError: (_error: any) => {},
  onSuccess: (_data: any, _key: string) => {}
}

interface SWRProviderProps {
  children: ReactNode
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig value={swrConfig}>
      {children}
    </SWRConfig>
  )
}
