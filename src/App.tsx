import { Layout } from './ui/Layout'
import { CertifyPage } from './ui/pages/CertifyPage'
import { VerifyPage } from './ui/pages/VerifyPage'
import { useRoute } from './ui/router'
import { useTheme } from './ui/useTheme'

export default function App() {
  useTheme()
  const { path } = useRoute()
  return <Layout>{path === '/verifica' ? <VerifyPage /> : <CertifyPage />}</Layout>
}
