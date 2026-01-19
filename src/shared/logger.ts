export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string, minLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.minLevel = minLevel;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.minLevel) return;

    const prefix = `[${this.context}]`;
    const formattedMessage = `${prefix} ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, data || '');
        break;
      case LogLevel.INFO:
        console.log(formattedMessage, data || '');
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data || '');
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, data || '');
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | any): void {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;
    this.log(LogLevel.ERROR, message, errorData);
  }
}

export function createLogger(context: string): Logger {
  // Default to INFO level for browser, DEBUG for Node.js development
  // In browser environment, we can't access process.env at runtime
  const minLevel = typeof window === 'undefined' ? LogLevel.DEBUG : LogLevel.INFO;
  return new Logger(context, minLevel);
}
