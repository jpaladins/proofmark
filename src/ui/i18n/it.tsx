import type { ReactNode } from 'react'
import type { UiRich } from './en'

export const itRich: UiRich = {
  dropZone: {
    orChoose: (choose: ReactNode, anySize: boolean): ReactNode => (
      <>
        oppure {choose}
        {anySize && ', di qualsiasi dimensione'}
      </>
    ),
  },
}
