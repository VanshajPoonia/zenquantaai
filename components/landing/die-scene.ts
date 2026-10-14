import * as THREE from 'three'

// The landing page's die. It is built as a hinged cube net so the same object
// can roll on the table and later unfold flat to show its inside. Face index
// i (0-5) carries i + 1 pips; the page decides which assistant sits on it.

export type DieMode = 'hero' | 'faces' | 'unfold'

export interface DieDirection {
  mode: DieMode
  /** Where the die rests, in normalized device coordinates. */
  anchor: { x: number; y: number }
  /** The face to show while scrolling through the assistants. */
  face: number
  /** 1 is a closed die, 0 is the flat net. */
  fold: number
  compact: boolean
}

export interface InsideFace {
  title: string
  line: string
  /** Lucide icon paths on a 24 unit grid, or 'logo' for the brand mark. */
  icon: string[] | 'logo'
}

export interface DieSceneOptions {
  canvas: HTMLCanvasElement
  faceColors: string[]
  ink: string
  bone: string
  feltShadow: string
  /** Inside faces, keyed by the pip count of the face they sit behind. */
  inside: Record<number, InsideFace>
  fonts: { display: string; body: string }
  logoUrl: string
  reducedMotion: boolean
  direct: () => DieDirection
  onSettle: (face: number) => void
}

export interface DieScene {
  roll: () => void
  showFace: (face: number) => void
  dragStart: (x: number, y: number) => void
  dragMove: (x: number, y: number) => void
  dragEnd: () => void
  setActive: (active: boolean) => void
  dispose: () => void
}

const SIZE = 2
const THICK = 0.07
const FOV = 30
const BASE_YAW = -0.55

// Net layout: the base square sits on the table with four walls hinged to it
// and the lid hinged to the far wall. Opposite faces add up to seven.
type NetKey = 'base' | 'near' | 'far' | 'east' | 'west' | 'lid'
const NET_PIPS: Record<NetKey, number> = {
  base: 6,
  near: 2,
  far: 5,
  east: 3,
  west: 4,
  lid: 1,
}

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.74, 0.26], [0.26, 0.74]],
  3: [[0.74, 0.26], [0.5, 0.5], [0.26, 0.74]],
  4: [[0.26, 0.26], [0.74, 0.26], [0.26, 0.74], [0.74, 0.74]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.26, 0.24], [0.26, 0.5], [0.26, 0.76], [0.74, 0.24], [0.74, 0.5], [0.74, 0.76]],
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function damp(current: number, target: number, rate: number, dt: number) {
  return target + (current - target) * Math.exp(-rate * dt)
}

function shade(hex: string, amount: number) {
  const color = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  color.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)))
  return `#${color.getHexString()}`
}

function grain(ctx: CanvasRenderingContext2D, size: number, alpha: number) {
  const image = ctx.getImageData(0, 0, size, size)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha
    data[i] += n
    data[i + 1] += n
    data[i + 2] += n
  }
  ctx.putImageData(image, 0, 0)
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function outerTexture(color: string, pips: number, ink: string) {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)

  // A lacquered face: light from the top left, a soft rounded rim.
  const light = ctx.createLinearGradient(0, 0, size, size)
  light.addColorStop(0, 'rgba(255,255,255,0.22)')
  light.addColorStop(0.55, 'rgba(255,255,255,0)')
  light.addColorStop(1, 'rgba(0,0,0,0.18)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, size, size)

  ctx.lineWidth = 18
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'
  roundedRect(ctx, 9, 9, size - 18, size - 18, 64)
  ctx.stroke()
  ctx.lineWidth = 6
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  roundedRect(ctx, 26, 26, size - 52, size - 52, 52)
  ctx.stroke()

  // Drilled pips: a dark hole with a lit lower rim.
  const radius = size * 0.082
  for (const [px, py] of PIP_LAYOUT[pips]) {
    const x = px * size
    const y = py * size
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.arc(x + 3, y + 4, radius + 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    const hole = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius)
    hole.addColorStop(0, 'rgba(0,0,0,0.55)')
    hole.addColorStop(1, 'rgba(255,255,255,0.10)')
    ctx.fillStyle = hole
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  grain(ctx, size, 0.05)
  return canvas
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function insideTexture(face: InsideFace, options: DieSceneOptions, logo: HTMLImageElement | null) {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const { ink, bone, fonts } = options

  ctx.fillStyle = bone
  ctx.fillRect(0, 0, size, size)

  // The printed fold line of a cut-out die template.
  ctx.setLineDash([18, 14])
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(12,31,24,0.35)'
  ctx.strokeRect(14, 14, size - 28, size - 28)
  ctx.setLineDash([])

  const iconSize = 132
  const iconX = (size - iconSize) / 2
  const iconY = 78
  if (face.icon === 'logo') {
    if (logo) {
      ctx.save()
      roundedRect(ctx, iconX, iconY, iconSize, iconSize, 28)
      ctx.clip()
      ctx.drawImage(logo, iconX - 20, iconY, iconSize + 40, iconSize)
      ctx.restore()
    }
  } else {
    ctx.save()
    ctx.translate(iconX, iconY)
    ctx.scale(iconSize / 24, iconSize / 24)
    ctx.lineWidth = 1.9
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = ink
    for (const d of face.icon) ctx.stroke(new Path2D(d))
    ctx.restore()
  }

  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `76px ${fonts.display}`
  ctx.fillText(face.title, size / 2, 300)

  ctx.font = `500 34px ${fonts.body}`
  ctx.fillStyle = 'rgba(12,31,24,0.78)'
  wrapLines(ctx, face.line, size - 96).forEach((line, index) => {
    ctx.fillText(line, size / 2, 356 + index * 42)
  })

  grain(ctx, size, 0.04)
  return canvas
}

function texture(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return map
}

interface Motion {
  from: THREE.Quaternion
  to: THREE.Quaternion
  axis: THREE.Vector3
  turns: number
  start: number
  duration: number
  hop: number
  drop: boolean
  face: number
  notify: boolean
}

export async function createDieScene(options: DieSceneOptions): Promise<DieScene> {
  const { canvas, reducedMotion } = options

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200)

  scene.add(new THREE.HemisphereLight('#fff6e0', options.feltShadow, 1.25))
  const key = new THREE.DirectionalLight('#fff1d6', 2.4)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -9
  key.shadow.camera.right = 9
  key.shadow.camera.top = 9
  key.shadow.camera.bottom = -9
  key.shadow.camera.near = 1
  key.shadow.camera.far = 40
  key.shadow.radius = 6
  key.shadow.bias = -0.0005
  scene.add(key, key.target)
  const rim = new THREE.DirectionalLight('#d8f0ff', 0.7)
  rim.position.set(6, 4, -6)
  scene.add(rim)

  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ color: options.feltShadow, opacity: 0.55 })
  )
  table.rotation.x = -Math.PI / 2
  table.receiveShadow = true
  scene.add(table)

  // Fonts must be ready before they are painted into textures.
  await Promise.all([
    document.fonts.load(`76px ${options.fonts.display}`),
    document.fonts.load(`500 34px ${options.fonts.body}`),
  ]).catch(() => undefined)
  const logo = await new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = options.logoUrl
  })

  const disposables: { dispose: () => void }[] = []
  const die = new THREE.Group()
  const net = new THREE.Group()
  net.position.y = -SIZE / 2 + THICK / 2
  die.add(net)
  scene.add(die)

  const planeGeometry = new THREE.PlaneGeometry(SIZE, SIZE)
  const slabGeometry = new THREE.BoxGeometry(SIZE * 0.995, THICK, SIZE * 0.995)
  disposables.push(planeGeometry, slabGeometry)

  const outerPlanes: Record<number, THREE.Mesh> = {}

  function square(pips: number) {
    const group = new THREE.Group()
    const color = options.faceColors[pips - 1]
    const outerMap = texture(outerTexture(color, pips, options.ink), renderer)
    const innerMap = texture(insideTexture(options.inside[pips], options, logo), renderer)
    const outerMaterial = new THREE.MeshStandardMaterial({ map: outerMap, roughness: 0.38, metalness: 0 })
    const innerMaterial = new THREE.MeshStandardMaterial({ map: innerMap, roughness: 0.9, metalness: 0 })
    const slabMaterial = new THREE.MeshStandardMaterial({ color: shade(color, -0.12), roughness: 0.5 })
    disposables.push(outerMap, innerMap, outerMaterial, innerMaterial, slabMaterial)

    const outer = new THREE.Mesh(planeGeometry, outerMaterial)
    outer.rotation.x = Math.PI / 2
    outer.position.y = -THICK / 2 - 0.002
    const inner = new THREE.Mesh(planeGeometry, innerMaterial)
    inner.rotation.x = -Math.PI / 2
    inner.position.y = THICK / 2 + 0.002
    const slab = new THREE.Mesh(slabGeometry, slabMaterial)
    slab.castShadow = true
    group.add(outer, inner, slab)
    outerPlanes[pips] = outer
    return group
  }

  function hinge(parent: THREE.Object3D, at: THREE.Vector3, pips: number) {
    const pivot = new THREE.Group()
    pivot.position.copy(at)
    const child = square(pips)
    child.position.copy(at)
    pivot.add(child)
    parent.add(pivot)
    return { pivot, child }
  }

  const half = SIZE / 2
  net.add(square(NET_PIPS.base))
  const near = hinge(net, new THREE.Vector3(0, 0, half), NET_PIPS.near)
  const far = hinge(net, new THREE.Vector3(0, 0, -half), NET_PIPS.far)
  const east = hinge(net, new THREE.Vector3(half, 0, 0), NET_PIPS.east)
  const west = hinge(net, new THREE.Vector3(-half, 0, 0), NET_PIPS.west)
  const lid = hinge(near.child, new THREE.Vector3(0, 0, half), NET_PIPS.lid)

  function applyFold(fold: number) {
    const angle = fold * (Math.PI / 2)
    near.pivot.rotation.x = -angle
    far.pivot.rotation.x = angle
    east.pivot.rotation.z = angle
    west.pivot.rotation.z = -angle
    lid.pivot.rotation.x = -angle
  }

  // For each face, the rotation that turns it to face up with its pips upright.
  applyFold(1)
  die.updateMatrixWorld(true)
  const faceUp: THREE.Quaternion[] = []
  const faceNormal: THREE.Vector3[] = []
  for (let pips = 1; pips <= 6; pips += 1) {
    const plane = outerPlanes[pips]
    const q = plane.getWorldQuaternion(new THREE.Quaternion())
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q).round()
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(q).round()
    const w = new THREE.Vector3().crossVectors(u, n)
    const m = new THREE.Matrix4().set(
      w.x, w.y, w.z, 0,
      n.x, n.y, n.z, 0,
      -u.x, -u.y, -u.z, 0,
      0, 0, 0, 1
    )
    faceUp[pips - 1] = new THREE.Quaternion().setFromRotationMatrix(m)
    faceNormal[pips - 1] = n
  }

  const yawQuat = (yaw: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
  const restingFor = (face: number, quarter: number) =>
    yawQuat(BASE_YAW + quarter * (Math.PI / 2)).multiply(faceUp[face])

  function nearestResting(face: number, from: THREE.Quaternion) {
    let best = restingFor(face, 0)
    let bestAngle = Infinity
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const candidate = restingFor(face, quarter)
      const angle = candidate.angleTo(from)
      if (angle < bestAngle) {
        bestAngle = angle
        best = candidate
      }
    }
    return best
  }

  function upFace(q: THREE.Quaternion) {
    let best = 0
    let bestY = -Infinity
    faceNormal.forEach((n, index) => {
      const y = n.clone().applyQuaternion(q).y
      if (y > bestY) {
        bestY = y
        best = index
      }
    })
    return best
  }

  // State
  const orientation = new THREE.Quaternion()
  let heroFace = 0
  let motion: Motion | null = null
  let lastMode: DieMode | null = null
  let lastFace = -1
  let fold = 1
  let hopY = 0
  const position = new THREE.Vector3()
  let positioned = false
  let elevation = 0.9
  let distance = 14
  let active = true
  let frame = 0
  let lastTime = performance.now()
  let idleSince = performance.now()
  let dragging = false
  let dragLast = { x: 0, y: 0, t: 0 }
  let dragSpeed = 0
  let dragMoved = 0

  function startMotion(to: THREE.Quaternion, config: Partial<Motion> & { face: number }) {
    if (reducedMotion) {
      orientation.copy(to)
      hopY = 0
      motion = null
      if (config.notify) options.onSettle(config.face)
      return
    }
    const axis = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
    motion = {
      from: orientation.clone(),
      to,
      axis,
      turns: 0,
      start: performance.now(),
      duration: 650,
      hop: 0.4,
      drop: false,
      notify: false,
      ...config,
    }
  }

  function roll(dropIn = false) {
    let next = Math.floor(Math.random() * 6)
    if (next === heroFace && !dropIn) next = (next + 1 + Math.floor(Math.random() * 5)) % 6
    heroFace = next
    startMotion(restingFor(next, Math.floor(Math.random() * 4)), {
      face: next,
      turns: dropIn ? 2 : 2 + Math.round(Math.random()),
      duration: dropIn ? 1500 : 1350,
      hop: dropIn ? 7 : 1.6,
      drop: dropIn,
      notify: true,
    })
  }

  function showFace(face: number) {
    heroFace = face
    startMotion(nearestResting(face, orientation), { face, hop: 0.9, duration: 700, notify: true })
  }

  function updateMotion(now: number) {
    if (!motion) return
    const t = Math.min(1, (now - motion.start) / motion.duration)
    const e = easeOutCubic(t)
    const spin = new THREE.Quaternion().setFromAxisAngle(motion.axis, motion.turns * Math.PI * 2 * e)
    orientation.slerpQuaternions(motion.from, motion.to, e).premultiply(spin)

    if (motion.drop) {
      if (t < 0.32) {
        const fall = t / 0.32
        hopY = motion.hop * (1 - fall * fall)
      } else {
        const u = (t - 0.32) / 0.68
        hopY = 1.1 * Math.abs(Math.sin(u * Math.PI * 2)) * Math.pow(1 - u, 2.2)
      }
    } else {
      hopY = motion.hop * Math.abs(Math.sin(t * Math.PI * 2)) * Math.pow(1 - t, 1.6)
    }

    if (t >= 1) {
      orientation.copy(motion.to)
      hopY = 0
      const done = motion
      motion = null
      idleSince = now
      if (done.notify) options.onSettle(done.face)
    }
  }

  function resize() {
    const parent = canvas.parentElement
    if (!parent) return
    const width = parent.clientWidth
    const height = parent.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / Math.max(1, height)
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(resize)
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement)
  resize()

  const raycaster = new THREE.Raycaster()
  const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = new THREE.Vector3()

  function tick(now: number) {
    frame = requestAnimationFrame(tick)
    const dt = Math.min(0.05, (now - lastTime) / 1000)
    lastTime = now
    if (!active) return

    const direction = options.direct()
    const rate = reducedMotion ? 60 : 7

    // Camera: low and close for the die, high and far for the flat net.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const aspect = camera.aspect
    const dieDistance = Math.max(direction.compact ? 15 : 14, (SIZE / 0.42 / Math.min(aspect, 1.4)) / (2 * tanHalf))
    const netDistance = Math.max(22, (6.6 / 0.92 / Math.min(aspect, 1.2)) / (2 * tanHalf))
    const flatness = 1 - fold
    const targetDistance = THREE.MathUtils.lerp(dieDistance, netDistance, flatness)
    const targetElevation = THREE.MathUtils.lerp(0.86, 1.32, flatness)
    distance = damp(distance, targetDistance, rate, dt)
    elevation = damp(elevation, targetElevation, rate, dt)
    camera.position.set(0, Math.sin(elevation) * distance, Math.cos(elevation) * distance)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    // Orientation follows the page.
    if (direction.mode !== lastMode || (direction.mode === 'faces' && direction.face !== lastFace)) {
      if (direction.mode === 'faces') {
        startMotion(nearestResting(direction.face, orientation), { face: direction.face, hop: 0.7 })
        lastFace = direction.face
      } else if (direction.mode === 'unfold') {
        startMotion(new THREE.Quaternion(), { face: 0, hop: 0.5, duration: 800 })
      } else if (lastMode !== null) {
        startMotion(nearestResting(heroFace, orientation), { face: heroFace, hop: 0.5 })
      }
      lastMode = direction.mode
    }

    if (!dragging) updateMotion(now)

    // A small nudge now and then says "pick me up".
    let wobble = 0
    if (!reducedMotion && !motion && !dragging && direction.mode === 'hero') {
      const idle = (now - idleSince) / 1000
      const phase = idle % 6
      if (idle > 3 && phase < 0.7) wobble = Math.sin((phase / 0.7) * Math.PI) * 0.09
    }

    const targetFold = direction.mode === 'unfold' ? direction.fold : 1
    fold = reducedMotion ? targetFold : damp(fold, targetFold, 10, dt)
    applyFold(fold)

    raycaster.setFromCamera(new THREE.Vector2(direction.anchor.x, direction.anchor.y), camera)
    if (raycaster.ray.intersectPlane(tablePlane, hit)) {
      if (!positioned) {
        position.copy(hit)
        positioned = true
      } else {
        position.x = damp(position.x, hit.x, rate, dt)
        position.z = damp(position.z, hit.z, rate, dt)
      }
    }

    die.position.set(position.x, SIZE / 2 + hopY + Math.abs(wobble) * 0.6, position.z - half * flatness)
    die.quaternion.copy(orientation)
    if (wobble) die.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0.4).normalize(), wobble))

    key.target.position.set(die.position.x, 0, die.position.z)
    key.position.set(die.position.x - 5, 12, die.position.z + 6)
    key.target.updateMatrixWorld()

    renderer.render(scene, camera)
  }

  frame = requestAnimationFrame(tick)
  if (reducedMotion) {
    orientation.copy(restingFor(0, 0))
    options.onSettle(0)
  } else {
    orientation.copy(restingFor(3, 1))
    roll(true)
  }

  return {
    roll: () => roll(false),
    showFace,
    dragStart(x, y) {
      dragging = true
      motion = null
      hopY = 0
      dragMoved = 0
      dragSpeed = 0
      dragLast = { x, y, t: performance.now() }
    },
    dragMove(x, y) {
      if (!dragging) return
      const now = performance.now()
      const dx = x - dragLast.x
      const dy = y - dragLast.y
      dragMoved += Math.abs(dx) + Math.abs(dy)
      const elapsed = Math.max(1, now - dragLast.t)
      dragSpeed = dragSpeed * 0.6 + (Math.hypot(dx, dy) / elapsed) * 0.4
      dragLast = { x, y, t: now }
      const turnY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.012)
      const turnX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.012)
      orientation.premultiply(turnY).premultiply(turnX)
    },
    dragEnd() {
      if (!dragging) return
      dragging = false
      if (dragMoved < 6 || dragSpeed > 0.9) {
        roll(false)
        return
      }
      const face = upFace(orientation)
      heroFace = face
      startMotion(nearestResting(face, orientation), { face, hop: 0.3, duration: 450, notify: true })
    },
    setActive(value) {
      active = value
      lastTime = performance.now()
    },
    dispose() {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      disposables.forEach((item) => item.dispose())
      table.geometry.dispose()
      ;(table.material as THREE.Material).dispose()
      renderer.dispose()
    },
  }
}
