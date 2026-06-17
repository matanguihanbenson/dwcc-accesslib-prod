import * as React from "react"

type AlertVariant = "default" | "destructive"

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {}

const getAlertClasses = (variant: AlertVariant = "default", className?: string) => {
  const baseClasses = "relative w-full rounded-lg border p-4 flex items-start gap-3"
  
  const variantClasses = {
    default: "bg-gray-50 border-gray-200 text-gray-800",
    destructive: "bg-red-50 border-red-200 text-red-800"
  }
  
  return `${baseClasses} ${variantClasses[variant]} ${className || ''}`
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={getAlertClasses(variant, className)}
      {...props}
    />
  )
)
Alert.displayName = "Alert"

const AlertDescription = React.forwardRef<HTMLDivElement, AlertDescriptionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`text-sm leading-relaxed ${className || ''}`}
      {...props}
    />
  )
)
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription }
