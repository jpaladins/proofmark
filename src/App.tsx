import { Layout } from './ui/Layout'
import { CertifyPage } from './ui/pages/CertifyPage'
import { PrivacyPage } from './ui/pages/PrivacyPage'
import { VerifyPage } from './ui/pages/VerifyPage'
import { useRoute } from './ui/router'
import { useTheme } from './ui/useTheme'

export default function App() {
  useTheme()
  const { path } = useRoute()
  const page = path === '/verifica' ? <VerifyPage /> : path === '/privacy' ? <PrivacyPage /> : <CertifyPage />
  return <Layout>{page}</Layout>
}
