interface LogContext {
  userId?: string
  username?: string
  action?: string
  resource?: string
  ip?: string
  userAgent?: string
  [key: string]: any
}

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date().toISOString()
    const level = entry.level.toUpperCase().padEnd(5)
    
    let logMessage = `[${timestamp}] ${level} ${entry.message}`
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      logMessage += ` | Context: ${JSON.stringify(entry.context)}`
    }
    
    if (entry.error) {
      logMessage += ` | Error: ${entry.error.name}: ${entry.error.message}`
      if (this.isDevelopment && entry.error.stack) {
        logMessage += `\n${entry.error.stack}`
      }
    }
    
    return logMessage
  }

  private log(level: LogEntry['level'], message: string, context?: LogContext, error?: Error) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    const formattedMessage = this.formatLogEntry(entry)

    // Logging disabled to prevent data exposure in console outputs.
    // Send to external service here if needed.
    void formattedMessage
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, context, error)
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      this.log('debug', message, context)
    }
  }

  // Specific logging methods for common operations
  authSuccess(username: string, ip?: string, userAgent?: string) {
    this.info('User authentication successful', {
      action: 'auth_success',
      username,
      ip,
      userAgent,
    })
  }

  authFailure(username: string, reason: string, ip?: string, userAgent?: string) {
    this.warn('User authentication failed', {
      action: 'auth_failure',
      username,
      reason,
      ip,
      userAgent,
    })
  }

  apiRequest(method: string, path: string, userId?: string, statusCode?: number) {
    this.info('API request processed', {
      action: 'api_request',
      method,
      resource: path,
      userId,
      statusCode,
    })
  }

  databaseOperation(operation: string, table: string, userId?: string, recordId?: string) {
    this.info('Database operation performed', {
      action: 'db_operation',
      operation,
      resource: table,
      userId,
      recordId,
    })
  }

  securityEvent(event: string, userId?: string, details?: any) {
    this.warn('Security event detected', {
      action: 'security_event',
      event,
      userId,
      ...details,
    })
  }
}

// Create singleton instance
export const logger = new Logger()
export default logger
