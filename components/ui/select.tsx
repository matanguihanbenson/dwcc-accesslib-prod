'use client'

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronDown } from "lucide-react"

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>
  // Where to position the dropdown relative to the trigger.
  // 'bottom' (default) = opens below the trigger
  // 'top' = opens above the trigger
  side: 'top' | 'bottom'
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

const useSelect = () => {
  const context = React.useContext(SelectContext)
  if (!context) {
    throw new Error("Select components must be used within a Select")
  }
  return context
}

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  side?: 'top' | 'bottom'
}

const Select = ({ value = "", onValueChange, children, side = 'bottom' }: SelectProps) => {
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState(value)
  // Ref to the trigger button so the dropdown can position itself next to
  // it. Required because the dropdown is portalled out of the trigger's
  // overflow container.
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const handleValueChange = React.useCallback((newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
    setOpen(false)
  }, [onValueChange])

  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value)
    }
  }, [value])

  return (
    <SelectContext.Provider
      value={{
        value: internalValue,
        onValueChange: handleValueChange,
        open,
        onOpenChange: setOpen,
        triggerRef,
        side,
      }}
    >
      {children}
    </SelectContext.Provider>
  )
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = useSelect()

    // Merge the forwarded ref with our internal triggerRef so the dropdown
    // can measure the trigger element.
    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref, triggerRef]
    )

    return (
      <button
        ref={setRefs}
        type="button"
        className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
        onClick={() => onOpenChange(!open)}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

interface SelectValueProps {
  placeholder?: string
  className?: string
}

const SelectValue = ({ placeholder, className }: SelectValueProps) => {
  const { value } = useSelect()

  return (
    <span className={className}>
      {value || placeholder}
    </span>
  )
}

interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

const SelectContent = ({ children, className }: SelectContentProps) => {
  const { open, onOpenChange, triggerRef, side } = useSelect()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState<{
    top: number
    left: number
    width: number
    transform: string
  } | null>(null)

  // Position the portalled dropdown. For `side: 'bottom'` (default) the
  // panel hangs just under the trigger. For `side: 'top'` it hangs above,
  // pinned by `transform: translateY(-100%)` so its bottom edge sits
  // 4px above the trigger's top edge.
  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    if (side === 'top') {
      setPosition({
        top: rect.top + window.scrollY - 4,
        left: rect.left + window.scrollX,
        width: rect.width,
        transform: 'translateY(-100%)',
      })
    } else {
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
        transform: 'none',
      })
    }
  }, [triggerRef, side])

  React.useEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        contentRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      onOpenChange(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onOpenChange, triggerRef])

  if (!open || !position || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={contentRef}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width: position.width,
        transform: position.transform,
      }}
      className={`z-[1000] overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg ${className || ''}`}
    >
      <div className="max-h-60 overflow-y-auto p-1">
        {children}
      </div>
    </div>,
    document.body
  )
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

const SelectItem = ({ value, children, className }: SelectItemProps) => {
  const { onValueChange, value: selectedValue } = useSelect()

  return (
    <div
      className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100 ${
        selectedValue === value ? 'bg-gray-100' : ''
      } ${className || ''}`}
      onClick={() => onValueChange(value)}
    >
      {children}
    </div>
  )
}

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
}
