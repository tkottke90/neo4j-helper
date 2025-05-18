
export interface Logger {
    debug: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    log: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
}