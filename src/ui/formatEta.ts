/** Time left for a long operation, in plain Italian. */
export function formatEta(sec: number): string {
  if (sec < 1) return 'quasi finito'
  if (sec < 60) return `circa ${Math.ceil(sec)} s rimanenti`
  return `circa ${Math.round(sec / 60)} min rimanenti`
}
