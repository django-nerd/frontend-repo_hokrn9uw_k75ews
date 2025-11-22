import { useEffect, useMemo, useState } from 'react'
import GameCanvas from './components/GameCanvas'

const backendBase = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function App() {
  const [screen, setScreen] = useState('menu') // menu | game | win | lose | leaderboard
  const [level, setLevel] = useState(1)
  const [hud, setHud] = useState({ elapsed: 0, level: 1 })
  const [name, setName] = useState('Agent')
  const [score, setScore] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])

  useEffect(() => {
    if (screen === 'leaderboard') {
      fetch(`${backendBase}/api/leaderboard`).then(r => r.json()).then(d => setLeaderboard(d.items || [])).catch(() => setLeaderboard([]))
    }
  }, [screen])

  const handleWin = async ({ points, duration_ms }) => {
    setScore({ points, duration_ms, level })
    setScreen('win')
  }
  const handleLose = () => setScreen('lose')

  const submitScore = async () => {
    try {
      const payload = { name: name || 'Agent', points: score.points, level, duration_ms: score.duration_ms }
      await fetch(`${backendBase}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setScreen('leaderboard')
    } catch (e) {
      setScreen('leaderboard')
    }
  }

  const Card = ({ children, className = '' }) => (
    <div className={`bg-slate-800/60 backdrop-blur border border-blue-500/20 rounded-2xl p-6 shadow-xl ${className}`}>{children}</div>
  )

  const Button = ({ children, onClick, variant = 'primary' }) => (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${variant === 'primary' ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-blue-100'}`}>{children}</button>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/flame-icon.svg" className="w-10 h-10" />
            <div>
              <h1 className="text-2xl font-bold">Stealth Agent</h1>
              <p className="text-blue-300/70 text-sm">Minimal top-down stealth challenge</p>
            </div>
          </div>
          <div className="text-right text-blue-200/80">
            <div>Level {hud.level}</div>
            <div>Time {hud.elapsed}s</div>
          </div>
        </header>

        {screen === 'menu' && (
          <Card>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="md:w-2/3 w-full">
                <GameCanvas level={level} onWin={handleWin} onLose={handleLose} setHud={setHud} />
              </div>
              <div className="md:w-1/3 w-full space-y-4">
                <div>
                  <label className="block text-sm text-blue-200/80 mb-1">Codename</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900/60 border border-blue-500/30 rounded px-3 py-2 outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-sm text-blue-200/80 mb-1">Level</label>
                  <input type="range" min={1} max={6} value={level} onChange={e => setLevel(parseInt(e.target.value))} className="w-full" />
                  <div className="text-sm text-blue-300/80">{level}</div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setScreen('game')}>Start Mission</Button>
                  <Button variant="secondary" onClick={() => setScreen('leaderboard')}>Leaderboard</Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {screen === 'game' && (
          <Card>
            <GameCanvas level={level} onWin={handleWin} onLose={handleLose} setHud={setHud} />
            <div className="mt-4 flex justify-between">
              <Button variant="secondary" onClick={() => setScreen('menu')}>Exit</Button>
              <div className="text-blue-300/70">Avoid the red cones and reach the star</div>
            </div>
          </Card>
        )}

        {screen === 'win' && score && (
          <Card className="text-center">
            <h2 className="text-2xl font-bold mb-2">Mission Complete</h2>
            <p className="text-blue-300/80 mb-4">Points: {score.points} • Time: {(score.duration_ms/1000).toFixed(1)}s • Level {level}</p>
            <div className="flex justify-center gap-3">
              <Button onClick={submitScore}>Save Score</Button>
              <Button variant="secondary" onClick={() => { setScreen('menu'); setScore(null); }}>Play Again</Button>
            </div>
          </Card>
        )}

        {screen === 'lose' && (
          <Card className="text-center">
            <h2 className="text-2xl font-bold mb-2">Mission Failed</h2>
            <div className="flex justify-center gap-3">
              <Button onClick={() => setScreen('game')}>Retry</Button>
              <Button variant="secondary" onClick={() => setScreen('menu')}>Back to Menu</Button>
            </div>
          </Card>
        )}

        {screen === 'leaderboard' && (
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Global Leaderboard</h2>
              <Button variant="secondary" onClick={() => setScreen('menu')}>Back</Button>
            </div>
            <div className="space-y-2">
              {leaderboard.length === 0 && <div className="text-blue-300/70">No scores yet. Be the first!</div>}
              {leaderboard.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-900/60 border border-blue-500/20 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-6 text-blue-400">#{idx + 1}</div>
                    <div className="font-semibold">{item.name}</div>
                  </div>
                  <div className="text-blue-300/80">{item.points} pts • L{item.level} • {(item.duration_ms/1000).toFixed(1)}s</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <footer className="text-center text-blue-300/60 text-sm">WASD/Arrow keys to move • Built for the browser</footer>
      </div>
    </div>
  )
}
