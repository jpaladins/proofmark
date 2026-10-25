import type { CertifyDeps } from './flow/certify'
import { LangProvider } from './ui/LangContext'
import { Layout } from './ui/Layout'
import { CertifyPage } from './ui/pages/CertifyPage'
import { PrivacyPage } from './ui/pages/PrivacyPage'
import { VerifyPage, type VerifyPageDeps } from './ui/pages/VerifyPage'
import { useRoute } from './ui/router'
import { useTheme } from './ui/useTheme'

/** The deps are for tests; the app uses the real ones. */
export default function App({ certifyDeps, verifyDeps }: { certifyDeps?: CertifyDeps; verifyDeps?: VerifyPageDeps } = {}) {
  useTheme()
  const { page, lang } = useRoute()
  // Verify starts over when the language changes: its results are worded in the language they were
  // computed in. Certify keeps its state (a receipt or an anchoring in flight) and localizes at render.
  const view =
    page === 'verify' ? (
      <VerifyPage key={lang} deps={verifyDeps} />
    ) : page === 'privacy' ? (
      <PrivacyPage />
    ) : (
      <CertifyPage deps={certifyDeps} />
    )
  return (
    <LangProvider>
      <Layout>{view}</Layout>
    </LangProvider>
  )
}
