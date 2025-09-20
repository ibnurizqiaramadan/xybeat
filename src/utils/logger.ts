/**
 * Logger utility class for consistent logging across the application.
 */
export class Logger {
  /**
   * Log an info message.
   * @param {string} message - The message to log.
   * @param {...unknown[]} args - Additional arguments to log.
   */
  static info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  }

  /**
   * Log a warning message.
   * @param {string} message - The message to log.
   * @param {...unknown[]} args - Additional arguments to log.
   */
  static warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  }

  /**
   * Log an error message.
   * @param {string} message - The message to log.
   * @param {Error} error - Optional error object.
   * @param {...unknown[]} args - Additional arguments to log.
   */
  static error(message: string, error?: Error, ...args: unknown[]): void {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error, ...args);
  }

  /**
   * Log a debug message (only in development).
   * @param {string} message - The message to log.
   * @param {...unknown[]} args - Additional arguments to log.
   */
  static debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
}
