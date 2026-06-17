'use client'

import * as React from "react"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

const useTabs = () => {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs")
  }
  return context
}

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

const Tabs = ({ value, onValueChange, children, className }: TabsProps) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

const TabsList = ({ children, className }: TabsListProps) => {
  return (
    <div
      className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500 ${className || ''}`}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

const TabsTrigger = ({ value, children, className }: TabsTriggerProps) => {
  const { value: selectedValue, onValueChange } = useTabs()
  const isActive = selectedValue === value

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? 'bg-white text-gray-950 shadow-sm'
          : 'hover:bg-gray-200 hover:text-gray-900'
      } ${className || ''}`}
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

const TabsContent = ({ value, children, className }: TabsContentProps) => {
  const { value: selectedValue } = useTabs()
  
  if (selectedValue !== value) {
    return null
  }

  return (
    <div
      className={`mt-2 ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className || ''}`}
    >
      {children}
    </div>
  )
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
}
