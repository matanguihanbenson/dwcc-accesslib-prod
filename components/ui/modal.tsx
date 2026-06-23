'use client'

import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ isOpen, onClose, title, children, className, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  // Render via portal at the document body level so the
  // overlay is never clipped or constrained by an ancestor
  // (transform / filter / overflow / perspective can all
  // turn `position: fixed` into a non-viewport-relative
  // box, which leaves a visible gap at the top).
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      // Full-viewport backdrop. `inset-0` plus explicit
      // `w-screen h-screen m-0 p-0` guarantees the black
      // overlay covers every pixel with no scroll-driven
      // offset. Padding for the modal content lives on
      // the inner centering div, not on the backdrop.
      className="fixed inset-0 z-[1000] w-screen h-screen m-0 p-0 bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-center min-h-screen w-full p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            'relative bg-white rounded-lg shadow-lg w-full',
            sizeClasses[size],
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-md p-2 hover:bg-gray-100"
              >
                <i className="fas fa-times" />
              </Button>
            </div>
          )}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-gray-600">{message}</p>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}