import { useEffect, useState } from 'react'
import GameCanvas from './components/GameCanvas'

const backendBase = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function App() {
  const [screen, setScreen] = useState('menu') // menu | game | win | lose | leaderboard
  const [level, setLevel] = useState(1)
  const [hud, setHud] = useState({ elapsed: 0, level: 1 })
  const [name, setName] = useState('Agent')
  const [score, setScore] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])

  const [ytUrl, setYtUrl] = useState('')
  const [ytError, setYtError] = useState('')
  const [ytLoading, setYtLoading] = useState(false)
  const [ytAck, setYtAck] = useState(false)
  const [ytProgress, setYtProgress] = useState(null) // null | number 0-100
  const [ytStatus, setYtStatus] = useState('')

  useEffect(() => {
    document.title = 'YT Video Downloader'
  }, [])

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

  const Button = ({ children, onClick, variant = 'primary', disabled = false }) => (
    <button disabled={disabled} onClick={onClick} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${variant === 'primary' ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-blue-100'}`}>{children}</button>
  )

  const saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'video.mp4'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const startYtDownload = async () => {
    setYtError('')
    setYtStatus('')
    setYtProgress(null)
    if (!ytUrl || !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(ytUrl)) {
      setYtError('Please paste a valid YouTube URL')
      return
    }
    if (!ytAck) {
      setYtError('Please confirm you have rights to download this content')
      return
    }

    try {
      setYtLoading(true)
      setYtStatus('Preparing...')

      // Prefer streaming fetch to keep user on the page and show progress
      const res = await fetch(`${backendBase}/api/download?url=${encodeURIComponent(ytUrl)}`)

      if (!res.ok) {
        let detail = 'Download failed'
        try {
          const data = await res.json()
          detail = data?.detail || detail
        } catch {}
        throw new Error(detail)
      }

      // Try to infer a filename
      const disp = res.headers.get('Content-Disposition') || ''
      const match = /filename="?([^";]+)"?/i.exec(disp)
      const filename = match ? match[1] : 'video.mp4'

      const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10)

      if (res.body && 'getReader' in res.body) {
        const reader = res.body.getReader()
        const chunks = []
        let received = 0
        setYtStatus('Downloading...')
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            received += value.length || value.byteLength || 0
            if (contentLength > 0) {
              setYtProgress(Math.min(100, Math.round((received / contentLength) * 100)))
            } else {
              // Indeterminate progress
              setYtProgress(null)
            }
          }
        }
        const blob = new Blob(chunks, { type: 'video/mp4' })
        saveBlob(blob, filename)
      } else {
        // Fallback: just blob the whole response
        const blob = await res.blob()
        saveBlob(blob, filename)
      }

      setYtStatus('Ready')
    } catch (e) {
      setYtError(e?.message || 'Unable to download the video')
    } finally {
      setYtLoading(false)
      setTimeout(() => {
        setYtStatus('')
        setYtProgress(null)
      }, 1500)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/flame-icon.svg" className="w-10 h-10" />
            <div>
              <h1 className="text-2xl font-bold">YT Video Downloader</h1>
              <p className="text-blue-300/70 text-sm">Download YouTube videos and play a quick stealth mission</p>
            </div>
          </div>
          <div className="text-right text-blue-200/80">
            <div>Level {hud.level}</div>
            <div>Time {hud.elapsed}s</div>
          </div>
        </header>

        {screen === 'menu' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <div className="flex flex-col gap-6 items-start">
                <GameCanvas level={level} onWin={handleWin} onLose={handleLose} setHud={setHud} />
                <div className="w-full space-y-4">
                  <div className="flex gap-3">
                    <Button onClick={() => setScreen('game')}>Start Mission</Button>
                    <Button variant="secondary" onClick={() => setScreen('leaderboard')}>Leaderboard</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-blue-200/80 mb-1">Codename</label>
                      <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900/60 border border-blue-500/30 rounded px-3 py-2 outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-sm text-blue-200/80 mb-1">Level</label>
                      <input type="range" min={1} max={6} value={level} onChange={e => setLevel(parseInt(e.target.value))} className="w-full" />
                      <div className="text-sm text-blue-300/80">{level}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold mb-2">YouTube Downloader</h3>
              <p className="text-sm text-blue-300/80 mb-3">Paste a YouTube link to download the video. Only use this for content you own or that has a permissive license.</p>
              <input
                value={ytUrl}
                onChange={e => setYtUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-slate-900/60 border border-blue-500/30 rounded px-3 py-2 outline-none focus:border-blue-400"
              />
              <label className="mt-3 flex items-center gap-2 text-xs text-blue-200/80">
                <input type="checkbox" checked={ytAck} onChange={e => setYtAck(e.target.checked)} />
                I confirm I have rights or permission to download this content.
              </label>
              {ytError && <div className="text-red-400 text-sm mt-2">{ytError}</div>}
              <div className="mt-3 flex gap-2 items-center">
                <Button onClick={startYtDownload} disabled={ytLoading || !ytUrl || !ytAck}>{ytLoading ? 'Downloading...' : 'Download'}</Button>
                <Button variant="secondary" onClick={() => { setYtUrl(''); setYtError(''); setYtProgress(null); setYtStatus(''); setYtAck(false) }}>Clear</Button>
                {ytStatus && <span className="text-xs text-blue-300/80">{ytStatus}</span>}
              </div>
              {ytLoading && (
                <div className="mt-3">
                  {typeof ytProgress === 'number' ? (
                    <div className="w-full bg-slate-700 rounded h-2 overflow-hidden">
                      <div className="bg-blue-500 h-2 transition-all" style={{ width: `${ytProgress}%` }} />
                    </div>
                  ) : (
                    <div className="text-xs text-blue-300/70">Downloading…</div>
                  )}
                </div>
              )}
              <div className="text-[11px] text-blue-300/60 mt-3">Respect creators’ rights. Check the license and terms before downloading.</div>
            </Card>
          </div>
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
