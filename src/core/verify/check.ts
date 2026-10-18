export type CheckId = 'hash' | 'ots-hash' | 'meta' | 'bitcoin'
export type Check = { id: CheckId; status: 'ok' | 'warn' | 'fail'; label: string; detail?: string }
