// Page text with inline markup, as React nodes. Plain strings live in src/i18n.
import type { ReactNode } from 'react'

export const enRich = {
  dropZone: {
    /** The line under the drop target; `choose` is the file picker's label. */
    orChoose: (choose: ReactNode, anySize: boolean): ReactNode => (
      <>
        or {choose}
        {anySize && ' of any size'}
      </>
    ),
  },
}

export type UiRich = typeof enRich
