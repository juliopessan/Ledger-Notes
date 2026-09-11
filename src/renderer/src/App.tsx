import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Record from './pages/Record'
import MeetingDetail from './pages/MeetingDetail'
import Settings from './pages/Settings'

export default function App(): JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = (): void => setRefreshKey((k) => k + 1)

  return (
    <div className="app-shell">
      <Sidebar refreshKey={refreshKey} />
      <main className="main">
        <div className="topbar" />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/record" element={<Record onCreated={bump} />} />
          <Route path="/meeting/:id" element={<MeetingDetail onChanged={bump} />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
