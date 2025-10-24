import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DeploymentList } from './components/DeploymentList'
import { DeploymentDetail } from './pages/DeploymentDetail'
import { SocietyDetail } from './pages/SocietyDetail'
import { Header } from './components/Header'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-100">
          <Header />
          <Routes>
            <Route path="/" element={<DeploymentList />} />
            <Route path="/deployments/:id" element={<DeploymentDetail />} />
            <Route path="/deployments/:unionId/societies/:societyId" element={<SocietyDetail />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
