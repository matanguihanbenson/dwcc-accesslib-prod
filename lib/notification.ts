// Simple notification utilities - SweetAlert removed
import Swal, { SweetAlertIcon } from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

export interface NotificationOptions {
  title?: string
  text?: string
  icon?: SweetAlertIcon
  confirmButtonText?: string
  cancelButtonText?: string
  showCancelButton?: boolean
  timer?: number
  timerProgressBar?: boolean
}

export class NotificationService {
  static success(title: string, text?: string, options?: Partial<NotificationOptions>) {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonText: options?.confirmButtonText || 'OK',
      timer: options?.timer,
      timerProgressBar: options?.timerProgressBar,
    })
  }

  static error(title: string, text?: string, options?: Partial<NotificationOptions>) {
    return Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonText: options?.confirmButtonText || 'OK',
    })
  }

  static warning(title: string, text?: string, options?: Partial<NotificationOptions>) {
    return Swal.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonText: options?.confirmButtonText || 'OK',
    })
  }

  static info(title: string, text?: string, options?: Partial<NotificationOptions>) {
    return Swal.fire({
      icon: 'info',
      title,
      text,
      confirmButtonText: options?.confirmButtonText || 'OK',
    })
  }

  static async confirm(
    title: string,
    text?: string,
    options?: Partial<NotificationOptions> | SweetAlertIcon
  ): Promise<boolean> {
    const normalizedOptions: Partial<NotificationOptions> =
      typeof options === 'string' ? { icon: options } : (options ?? {})

    const result = await Swal.fire({
      icon: normalizedOptions.icon || 'question',
      title,
      text,
      showCancelButton: normalizedOptions.showCancelButton ?? true,
      confirmButtonText: normalizedOptions.confirmButtonText || 'Confirm',
      cancelButtonText: normalizedOptions.cancelButtonText || 'Cancel',
    })

    return result.isConfirmed
  }

  static async confirmDelete(itemName: string = 'item') {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Are you sure?',
      text: `This will permanently delete the ${itemName}. This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
    })
    return result.isConfirmed
  }

  static loading(title: string = 'Processing...', text?: string) {
    Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading()
      }
    })
  }

  static close() {
    Swal.close()
  }

  static toast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    return Swal.fire({
      icon: type,
      title: message,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
    })
  }

  static async input(title: string, inputPlaceholder?: string, inputValue?: string) {
    const { value } = await Swal.fire({
      title,
      input: 'text',
      inputPlaceholder,
      inputValue,
      showCancelButton: true,
    })
    return value?.trim() || null
  }

  static async inputPassword(title: string, inputPlaceholder?: string) {
    const { value } = await Swal.fire({
      title,
      input: 'password',
      inputPlaceholder,
      inputAttributes: { minlength: '8' },
      showCancelButton: true,
    })
    if (!value) return null
    if (value.length < 8) {
      await Swal.fire({ icon: 'error', title: 'Password must be at least 8 characters long!' })
      return null
    }
    return value
  }

  static async select(
    title: string,
    options: Record<string, string>,
    inputPlaceholder?: string
  ) {
    const { value } = await Swal.fire({
      title,
      input: 'select',
      inputOptions: options,
      inputPlaceholder,
      showCancelButton: true,
    })
    return value || null
  }
}

export const notify = NotificationService