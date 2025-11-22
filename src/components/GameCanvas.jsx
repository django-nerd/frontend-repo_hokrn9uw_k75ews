import { useEffect, useRef } from 'react'

/*
Simple top-down stealth mini-game inspired by Assassin-style gameplay.
- Move with WASD / Arrow keys or on-screen joystick (drag)
- Avoid red vision cones
- Reach the yellow objective star to win the level
- If spotted, game over
*/

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

function useKeys() {
  const keys = useRef({})
  useEffect(() => {
    const down = e => (keys.current[e.key.toLowerCase()] = true)
    const up = e => (keys.current[e.key.toLowerCase()] = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  return keys
}

export default function GameCanvas({ onWin, onLose, level = 1, setHud }) {
  const canvasRef = useRef(null)
  const keys = useKeys()
  const gameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Responsive size
    const resize = () => {
      const parent = canvas.parentElement
      const w = Math.min(parent.clientWidth, 900)
      const h = Math.min(window.innerHeight - 200, 700)
      canvas.width = w
      canvas.height = h
    }
    resize()
    window.addEventListener('resize', resize)

    // World setup
    const world = {
      w: canvas.width,
      h: canvas.height,
      tile: 40,
    }

    const player = {
      x: 40,
      y: world.h - 60,
      r: 12,
      speed: 2.2 + level * 0.1,
    }

    // Build some simple walls
    const walls = []
    const addWall = (x, y, w, h) => walls.push({ x, y, w, h })
    // Per-level layout variety
    addWall(0, 0, world.w, 20)
    addWall(0, world.h - 20, world.w, 20)
    addWall(0, 0, 20, world.h)
    addWall(world.w - 20, 0, 20, world.h)

    // Internal walls
    for (let i = 1; i <= level + 3; i++) {
      const y = i * (world.h / (level + 4))
      addWall(world.w * 0.25, y - 6, world.w * 0.5, 12)
    }

    const objective = { x: world.w - 60, y: 60, r: 14 }

    // Enemies with patrol routes
    const enemies = []
    const addEnemy = (path, speed = 1.2 + level * 0.05, fov = Math.PI / 3, view = 160) => {
      enemies.push({ path, speed, fov, view, idx: 0, t: 0, x: path[0].x, y: path[0].y, dir: 0 })
    }

    const makePath = (x1, y1, x2, y2) => [{ x: x1, y: y1 }, { x: x2, y: y2 }]

    addEnemy(makePath(world.w * 0.25, 80, world.w * 0.75, 80))
    addEnemy(makePath(world.w * 0.25, world.h * 0.5, world.w * 0.75, world.h * 0.5), 1.4)
    addEnemy(makePath(world.w * 0.25, world.h - 80, world.w * 0.75, world.h - 80), 1.1)

    if (level >= 3) addEnemy(makePath(80, 120, 80, world.h - 120), 1.0)
    if (level >= 5) addEnemy(makePath(world.w - 80, 140, world.w - 80, world.h - 160), 1.3)

    // Helpers
    const circleIntersectsRect = (cx, cy, r, rect) => {
      const rx = clamp(cx, rect.x, rect.x + rect.w)
      const ry = clamp(cy, rect.y, rect.y + rect.h)
      const dx = cx - rx
      const dy = cy - ry
      return dx * dx + dy * dy < r * r
    }

    const lineOfSight = (x1, y1, x2, y2) => {
      // crude: check against walls by sampling
      const steps = 20
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const x = x1 + (x2 - x1) * t
        const y = y1 + (y2 - y1) * t
        for (const w of walls) {
          if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return false
        }
      }
      return true
    }

    const overlapsWalls = (x, y, r) => walls.some(w => circleIntersectsRect(x, y, r, w))

    const moveWithCollision = (obj, dx, dy) => {
      let nx = obj.x + dx
      let ny = obj.y + dy
      if (!overlapsWalls(nx, obj.y, obj.r)) obj.x = nx
      if (!overlapsWalls(obj.x, ny, obj.r)) obj.y = ny
    }

    const startedAt = performance.now()

    const drawWalls = () => {
      ctx.fillStyle = 'rgba(15,23,42,1)'
      ctx.fillRect(0, 0, world.w, world.h)
      ctx.fillStyle = 'rgba(30,41,59,1)'
      walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h))
    }

    const drawObjective = () => {
      ctx.save()
      ctx.translate(objective.x, objective.y)
      ctx.fillStyle = '#facc15'
      // star
      const r = objective.r
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        const a2 = a + Math.PI / 5
        ctx.lineTo(Math.cos(a2) * (r / 2), Math.sin(a2) * (r / 2))
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    const drawPlayer = () => {
      ctx.fillStyle = '#60a5fa'
      ctx.beginPath()
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawEnemy = (e) => {
      // Vision cone
      ctx.save()
      ctx.translate(e.x, e.y)
      ctx.rotate(e.dir)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.view)
      g.addColorStop(0, 'rgba(239,68,68,0.28)')
      g.addColorStop(1, 'rgba(239,68,68,0.02)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, e.view, -e.fov / 2, e.fov / 2)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Body
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(e.x, e.y, 10, 0, Math.PI * 2)
      ctx.fill()
    }

    const updateEnemy = (e) => {
      const target = e.path[e.idx]
      const dx = target.x - e.x
      const dy = target.y - e.y
      const dist = Math.hypot(dx, dy)
      if (dist < 2) {
        e.idx = (e.idx + 1) % e.path.length
        return
      }
      const ux = dx / dist
      const uy = dy / dist
      e.x += ux * e.speed
      e.y += uy * e.speed
      e.dir = Math.atan2(uy, ux)
    }

    const spotted = (e) => {
      const dx = player.x - e.x
      const dy = player.y - e.y
      const dist = Math.hypot(dx, dy)
      if (dist > e.view) return false
      const ang = Math.atan2(dy, dx)
      const da = Math.atan2(Math.sin(ang - e.dir), Math.cos(ang - e.dir))
      if (Math.abs(da) > e.fov / 2) return false
      return lineOfSight(e.x, e.y, player.x, player.y)
    }

    const inputVec = () => {
      let x = 0, y = 0
      if (keys.current['arrowup'] || keys.current['w']) y -= 1
      if (keys.current['arrowdown'] || keys.current['s']) y += 1
      if (keys.current['arrowleft'] || keys.current['a']) x -= 1
      if (keys.current['arrowright'] || keys.current['d']) x += 1
      const len = Math.hypot(x, y) || 1
      return { x: x / len, y: y / len }
    }

    let running = true

    const tick = () => {
      if (!running) return

      // Update
      const v = inputVec()
      moveWithCollision(player, v.x * player.speed, v.y * player.speed)
      enemies.forEach(updateEnemy)

      // Detect spotted
      for (const e of enemies) {
        if (spotted(e)) {
          running = false
          onLose && onLose()
          return
        }
      }

      // Win
      if (Math.hypot(player.x - objective.x, player.y - objective.y) < player.r + objective.r) {
        running = false
        const duration = Math.max(1, Math.floor(performance.now() - startedAt))
        onWin && onWin({ points: Math.floor(1000 + level * 250 - duration * 0.2), duration_ms: duration })
        return
      }

      // Draw
      ctx.clearRect(0, 0, world.w, world.h)
      drawWalls()
      drawObjective()
      enemies.forEach(drawEnemy)
      drawPlayer()

      // HUD stats
      const elapsed = Math.floor((performance.now() - startedAt) / 1000)
      setHud && setHud({ elapsed, level })

      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)

    gameRef.current = { stop: () => (running = false) }

    return () => {
      running = false
      window.removeEventListener('resize', resize)
    }
  }, [level, onWin, onLose, setHud])

  return (
    <canvas ref={canvasRef} className="w-full rounded-xl border border-blue-500/30 bg-slate-900 shadow-inner shadow-black" />
  )
}
