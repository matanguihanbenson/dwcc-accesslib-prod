'use client'

import * as React from "react"
import { Check } from "lucide-react"

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onCheckedChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          className="sr-only"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <div
          className={`h-4 w-4 shrink-0 rounded-sm border border-gray-300 ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
            checked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white'
          } ${className || ''}`}
          onClick={() => onCheckedChange?.(!checked)}
        >
          {checked && (
            <Check className="h-3 w-3 text-white m-0.5" />
          )}
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
