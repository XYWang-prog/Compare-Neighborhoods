import { Routes, Route, Navigate } from 'react-router-dom'
import OnboardingPage from './pages/OnboardingPage'
import PreferencesPage from './pages/PreferencesPage'
import PriorityPage from './pages/PriorityPage'
import ComparePage from './pages/ComparePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<OnboardingPage />} />
      <Route path="/preferences" element={<PreferencesPage />} />
      <Route path="/priority" element={<PriorityPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
