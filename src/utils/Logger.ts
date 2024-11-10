interface ColorOptions {
  color?: AnsiColor;
  full?: boolean;
}

export enum AnsiColor {
  Purple = '\x1b[35m',
  Green = '\x1b[32m',
  Orange = '\x1b[38;5;208m',
  Yellow = '\x1b[33m',
  Reset = '\x1b[0m',
  Cyan = '\x1b[36m',
  Grey = '\x1b[90m',
  Red = '\x1b[31m'
}

export default class Logger {
  private static readonly LOG_LEVELS = {
    INFO: { color: AnsiColor.Cyan },
    WARN: { color: AnsiColor.Yellow },
    DEBUG: { color: AnsiColor.Orange },
    ERROR: { color: AnsiColor.Red },
    FATAL: { color: AnsiColor.Red }
  } as const;

  private static formatTimestamp(): string {
    const timestamp = new Date().toISOString();
    return `${AnsiColor.Grey}[${timestamp}]${AnsiColor.Reset}`;
  }

  private static formatLevel(level: string, color?: AnsiColor): string {
    return color ? `${color}[${level}]${AnsiColor.Reset}` : `[${level}]`;
  }

  private static formatMessage(message: string, options?: ColorOptions): string {
    if (options?.color && options.full) {
      return `${options.color}${message}${AnsiColor.Reset}`;
    }
    return message;
  }

  private static formatLogMessage(level: string, message: string, options?: ColorOptions): string {
    const timestamp = this.formatTimestamp();
    const formattedLevel = this.formatLevel(level, options?.color);
    const formattedMessage = this.formatMessage(message, options);
    return `${timestamp} ${formattedLevel} ${formattedMessage}`;
  }

  static log(level: string, message: string, options?: ColorOptions): void {
    console.log(this.formatLogMessage(level, message, options));
  }

  static info(message: string): void {
    this.log('INFO', message, { color: this.LOG_LEVELS.INFO.color });
  }

  static warn(message: string): void {
    this.log('WARN', message, { color: this.LOG_LEVELS.WARN.color });
  }

  static debug(message: string, ...values: readonly unknown[]): void {
    this.log('DEBUG', message, { color: this.LOG_LEVELS.DEBUG.color });
    console.debug(...values);
  }

  static error(message: string, ...values: readonly unknown[]): void {
    this.log('ERROR', message, { color: this.LOG_LEVELS.ERROR.color });
    console.error(...values);
  }

  static fatal(message: string, ...values: readonly unknown[]): void {
    this.log('FATAL', message, { color: this.LOG_LEVELS.FATAL.color });
    console.error(...values);
  }
}
