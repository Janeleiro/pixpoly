import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GameProvider } from './context/GameContext.jsx'
import Home from './pages/Home.jsx'
import Room from './pages/Room.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:code" element={<Room />} />
        </Routes>
      </GameProvider>
    </BrowserRouter>
  )
}
