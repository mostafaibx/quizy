
/**
 * Structured Logging Service
 * Optimized for Cloudflare Workers - minimal CPU usage in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;
  private serviceName: string;

  constructor(serviceName: string, isDevelopment = false) {
    this.serviceName = serviceName;
    this.isDevelopment = isDevelopment;
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only log warnings and errors to save CPU time
    if (!this.isDevelopment && (level === 'debug' || level === 'info')) {
      return false;
    }
    return true;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}][${this.serviceName}][${level.toUpperCase()}]`;
    
    if (context && Object.keys(context).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(context)}`;
    }
    return `${prefix} ${message}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = {
        ...context,
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: this.isDevelopment ? error.stack : undefined,
        } : error,
      };
      console.error(this.formatMessage('error', message, errorContext));
    }
  }

  // Request logging - compact format
  logRequest(method: string, url: string, statusCode?: number, duration?: number): void {
    if (this.isDevelopment) {
      const context: LogContext = { method, url };
      if (statusCode) context.statusCode = statusCode;
      if (duration) context.duration = `${duration}ms`;
      this.info('Request', context);
    }
  }
}

export const createLogger = (serviceName: string, env?: string): Logger => {
  const isDevelopment = env !== 'production' && (!env || env === 'development');
  return new Logger(serviceName, isDevelopment);
};

// Export singleton loggers for common services
export const qstashLogger = (env?: string) => createLogger('QStash', env);
export const fileLogger = (env?: string) => createLogger('FileService', env);
export const firestoreLogger = (env?: string) => createLogger('Firestore', env);

