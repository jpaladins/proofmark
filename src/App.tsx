import { LangProvider } from './ui/LangContext'
import { Layout } from './ui/Layout'
import { CertifyPage } from './ui/pages/CertifyPage'
import { PrivacyPage } from './ui/pages/PrivacyPage'
import { VerifyPage } from './ui/pages/VerifyPage'
import { useRoute } from './ui/router'
import { useTheme } from './ui/useTheme'

export default function App() {
  useTheme()
  const { page } = useRoute()
  const view = page === 'verify' ? <VerifyPage /> : page === 'privacy' ? <PrivacyPage /> : <CertifyPage />
  return (
    <LangProvider>
      <Layout>{view}</Layout>
    </LangProvider>
  )
}
