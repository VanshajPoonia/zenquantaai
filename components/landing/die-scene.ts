import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// The landing page's die: one rounded onyx block with lacquered pips inlaid
// in each assistant's colour. Face index i (0-5) carries i + 1 pips.
//
// Motion is a small hand-rolled throw rather than a physics engine: gravity
// and bounces for height, a roll about the travel axis that eases out onto
// the chosen face, and the die's real lowest point (which depends on how it
// is turned) kept on the table, so it lands on corners and rocks flat.
//
// Rendering is on demand. Frames run while something moves and stop when the
// die is at rest, so a die sitting on screen costs nothing.

export interface DieSceneOptions {
  canvas: HTMLCanvasElement
  /** Pip colour for each face, in face order. */
  pipColors: string[]
  /** The block itself. */
  body: string
  /** How far the canvas reaches above its stage, as a share of the stage's
   *  height, so a tossed die has sky to fly into. The die is framed as if
   *  the canvas were the stage alone. */
  overhang?: number
  reducedMotion: boolean
  onSettle: (face: number) => void
}

export interface DieScene {
  roll: () => void
  showFace: (face: number) => void
  pointerDown: (x: number, y: number) => void
  pointerMove: (x: number, y: number) => void
  pointerUp: () => void
  /** The browser took the pointer (a scroll, say): put the die down. */
  pointerCancel: () => void
  hover: (x: number, y: number) => void
  leave: () => void
  setActive: (active: boolean) => void
  dispose: () => void
}

const SIZE = 2
const HALF = SIZE / 2
const RADIUS = 0.26
const FOV = 28
const DISTANCE = 11.5
const ELEVATION = 0.68
const BASE_YAW = -0.52
const GRAVITY = 34
const BOUNCE = 0.4
const REACH = 1.35
const LIFT = 1.15
const UP = new THREE.Vector3(0, 1, 0)

// BoxGeometry side order: +x, -x, +y, -y, +z, -z. Opposite sides add up to
// seven, like a real die.
const SIDE_PIPS = [3, 4, 1, 6, 2, 5]
const SIDE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
]

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.73, 0.27], [0.27, 0.73]],
  3: [[0.73, 0.27], [0.5, 0.5], [0.27, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.27, 0.5], [0.27, 0.75], [0.73, 0.25], [0.73, 0.5], [0.73, 0.75]],
}

const CELL = 384

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const damp = (current: number, target: number, rate: number, dt: number) =>
  target + (current - target) * Math.exp(-rate * dt)

const yieldToPage = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0))

// The share of a side's UV square taken by the rounded edge on each side, as
// RoundedBoxGeometry lays it out. Pips are drawn inside the flat part.
function edgeShare() {
  const arc = (Math.PI * RADIUS) / 2
  const flat = SIZE - 2 * RADIUS
  return (0.5 * arc) / (arc + flat)
}

function shade(hex: string, amount: number) {
  const color = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  color.setHSL(hsl.h, hsl.s, clamp(hsl.l + amount, 0, 1))
  return `#${color.getHexString()}`
}

// Two atlases, one cell per face: colour (also used as the glow map, since
// the onyx is near black and only the pips give off light) and height for
// the drilled pips.
function paintAtlases(pipColors: string[], body: string) {
  const color = document.createElement('canvas')
  const height = document.createElement('canvas')
  color.width = height.width = CELL * 3
  color.height = height.height = CELL * 2
  const c = color.getContext('2d')!
  const h = height.getContext('2d')!

  c.fillStyle = body
  c.fillRect(0, 0, color.width, color.height)
  h.fillStyle = '#fff'
  h.fillRect(0, 0, height.width, height.height)

  // Fine grain so the black reads as a material, not a void.
  const tile = document.createElement('canvas')
  tile.width = tile.height = 96
  const tileContext = tile.getContext('2d')!
  const noise = tileContext.createImageData(96, 96)
  for (let i = 0; i < noise.data.length; i += 4) {
    const value = 128 + (Math.random() - 0.5) * 255
    noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = value
    noise.data[i + 3] = 255
  }
  tileContext.putImageData(noise, 0, 0)
  const pattern = c.createPattern(tile, 'repeat')
  if (pattern) {
    c.save()
    c.globalAlpha = 0.05
    c.globalCompositeOperation = 'overlay'
    c.fillStyle = pattern
    c.fillRect(0, 0, color.width, color.height)
    c.restore()
  }

  const edge = edgeShare()
  const inner = CELL * (1 - 2 * edge)
  for (let face = 0; face < 6; face += 1) {
    const pips = face + 1
    const ox = (face % 3) * CELL + edge * CELL
    const oy = Math.floor(face / 3) * CELL + edge * CELL
    const hue = pipColors[face]
    const radius = inner * (pips === 1 ? 0.13 : 0.088)
    for (const [px, py] of PIP_LAYOUT[pips]) {
      const x = ox + px * inner
      const y = oy + py * inner

      // Lacquer: lit from the top left, deeper toward the far wall.
      const fill = c.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.1, x, y, radius)
      fill.addColorStop(0, shade(hue, 0.12))
      fill.addColorStop(0.7, hue)
      fill.addColorStop(1, shade(hue, -0.16))
      c.fillStyle = fill
      c.beginPath()
      c.arc(x, y, radius, 0, Math.PI * 2)
      c.fill()
      // The drilled lip.
      c.lineWidth = Math.max(1.5, radius * 0.1)
      c.strokeStyle = 'rgba(0,0,0,0.55)'
      c.beginPath()
      c.arc(x, y, radius - c.lineWidth / 2, 0, Math.PI * 2)
      c.stroke()

      const bowl = h.createRadialGradient(x, y, 0, x, y, radius * 1.12)
      bowl.addColorStop(0, '#2a2a2a')
      bowl.addColorStop(0.8, '#5a5a5a')
      bowl.addColorStop(1, '#fff')
      h.fillStyle = bowl
      h.beginPath()
      h.arc(x, y, radius * 1.12, 0, Math.PI * 2)
      h.fill()
    }
  }
  return { color, height }
}

function blobTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  return map
}

// Vertical flight: a launch, then bounces that lose energy until the die
// stays down.
interface Hop {
  start: number
  end: number
  height: number
  speed: number
}

function plan(height: number, speed: number) {
  const hops: Hop[] = []
  let time = 0
  let h = height
  let v = speed
  for (let i = 0; i < 8; i += 1) {
    const air = (v + Math.sqrt(v * v + 2 * GRAVITY * h)) / GRAVITY
    hops.push({ start: time, end: time + air, height: h, speed: v })
    time += air
    v = -(v - GRAVITY * air) * BOUNCE
    h = 0
    if (v < 0.6) break
  }
  return { hops, duration: time }
}

function heightAt(hops: Hop[], time: number) {
  for (const hop of hops) {
    if (time <= hop.end) {
      const t = time - hop.start
      return Math.max(0, hop.height + hop.speed * t - 0.5 * GRAVITY * t * t)
    }
  }
  return 0
}

interface Throw {
  kind: 'throw'
  start: number
  duration: number
  hops: Hop[]
  from: THREE.Vector3
  to: THREE.Vector3
  axis: THREE.Vector3
  angle: number
  spin: number
  end: THREE.Quaternion
  /** Takes the scripted path's first pose to where the die really was, and
   *  fades out while it is still spinning fast. */
  correction: THREE.Quaternion
  blend: number
  face: number
  notify: boolean
}

interface Flip {
  kind: 'flip'
  start: number
  duration: number
  from: THREE.Quaternion
  end: THREE.Quaternion
  lift: number
  face: number
  notify: boolean
}

type Motion = Throw | Flip

const ROCK = 0.55

export async function createDieScene(options: DieSceneOptions): Promise<DieScene> {
  const { canvas, reducedMotion } = options

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
  camera.position.set(0, Math.sin(ELEVATION) * DISTANCE, Math.cos(ELEVATION) * DISTANCE)
  camera.lookAt(0, 0.55, 0)

  // Soft studio reflections give the clear coat something to show.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04).texture
  scene.environment = environment
  scene.environmentIntensity = 0.55
  pmrem.dispose()
  room.dispose()

  scene.add(new THREE.HemisphereLight('#f4f6ff', '#000000', 0.35))
  const key = new THREE.DirectionalLight('#fff3e2', 2.3)
  key.position.set(-4.5, 9, 6)
  const rim = new THREE.DirectionalLight('#dcecff', 1.3)
  rim.position.set(6, 3.5, -6)
  scene.add(key, rim)

  await yieldToPage()
  const atlases = paintAtlases(options.pipColors, options.body)
  await yieldToPage()

  const anisotropy = renderer.capabilities.getMaxAnisotropy()
  const colorMap = new THREE.CanvasTexture(atlases.color)
  colorMap.colorSpace = THREE.SRGBColorSpace
  colorMap.anisotropy = anisotropy
  const heightMap = new THREE.CanvasTexture(atlases.height)
  heightMap.anisotropy = anisotropy

  const geometry = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 5, RADIUS)

  // Work out which way is "up" on each side's texture before the UVs move
  // into the atlas, then point each side at its atlas cell.
  const position = geometry.attributes.position as THREE.BufferAttribute
  const uv = geometry.attributes.uv as THREE.BufferAttribute
  const faceUp: THREE.Quaternion[] = []
  const faceNormal: THREE.Vector3[] = []
  geometry.groups.forEach((group, side) => {
    const normal = SIDE_NORMALS[side]
    const centre = normal.clone().multiplyScalar(HALF)
    let best = group.start
    let bestDistance = Infinity
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    for (let i = group.start; i < group.start + group.count; i += 3) {
      a.fromBufferAttribute(position, i)
      b.fromBufferAttribute(position, i + 1)
      c.fromBufferAttribute(position, i + 2)
      const distance = a.add(b).add(c).divideScalar(3).distanceTo(centre)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    }
    const p0 = new THREE.Vector3().fromBufferAttribute(position, best)
    const e1 = new THREE.Vector3().fromBufferAttribute(position, best + 1).sub(p0)
    const e2 = new THREE.Vector3().fromBufferAttribute(position, best + 2).sub(p0)
    const du1 = uv.getX(best + 1) - uv.getX(best)
    const dv1 = uv.getY(best + 1) - uv.getY(best)
    const du2 = uv.getX(best + 2) - uv.getX(best)
    const dv2 = uv.getY(best + 2) - uv.getY(best)
    const r = 1 / (du1 * dv2 - du2 * dv1)
    // Direction of increasing v: the top of the texture.
    const up = e2.clone().multiplyScalar(du1 * r).sub(e1.clone().multiplyScalar(du2 * r)).normalize().round()
    const across = new THREE.Vector3().crossVectors(normal, up)
    const m = new THREE.Matrix4().set(
      -across.x, -across.y, -across.z, 0,
      normal.x, normal.y, normal.z, 0,
      -up.x, -up.y, -up.z, 0,
      0, 0, 0, 1
    )
    const face = SIDE_PIPS[side] - 1
    faceUp[face] = new THREE.Quaternion().setFromRotationMatrix(m)
    faceNormal[face] = normal.clone()

    const col = face % 3
    const row = Math.floor(face / 3)
    for (let i = group.start; i < group.start + group.count; i += 1) {
      uv.setXY(i, (col + uv.getX(i)) / 3, (uv.getY(i) + 1 - row) / 2)
    }
  })
  uv.needsUpdate = true
  geometry.clearGroups()

  const material = new THREE.MeshPhysicalMaterial({
    map: colorMap,
    emissiveMap: colorMap,
    emissive: '#ffffff',
    emissiveIntensity: 0.26,
    bumpMap: heightMap,
    bumpScale: 2.4,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
  })
  const die = new THREE.Mesh(geometry, material)
  scene.add(die)

  // Contact shadows: a wide soft one that spreads as the die rises, and a
  // tight dark one that only exists while it touches the table.
  const blob = blobTexture()
  const shadowGeometry = new THREE.PlaneGeometry(1, 1)
  const softShadow = new THREE.Mesh(
    shadowGeometry,
    new THREE.MeshBasicMaterial({ map: blob, color: '#000', transparent: true, depthWrite: false, opacity: 0.6 })
  )
  const contactShadow = new THREE.Mesh(
    shadowGeometry,
    new THREE.MeshBasicMaterial({ map: blob, color: '#000', transparent: true, depthWrite: false, opacity: 0.7 })
  )
  softShadow.rotation.x = contactShadow.rotation.x = -Math.PI / 2
  softShadow.position.y = 0.001
  contactShadow.position.y = 0.002
  softShadow.renderOrder = 1
  contactShadow.renderOrder = 2
  scene.add(softShadow, contactShadow)

  // Orientation helpers
  const yawQuat = (yaw: number) => new THREE.Quaternion().setFromAxisAngle(UP, yaw)
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
    faceNormal.forEach((normal, index) => {
      const y = normal.clone().applyQuaternion(q).y
      if (y > bestY) {
        bestY = y
        best = index
      }
    })
    return best
  }

  // How far the die's lowest point sits below its centre, turned this way.
  const basis = new THREE.Matrix4()
  function reach(q: THREE.Quaternion) {
    const e = basis.makeRotationFromQuaternion(q).elements
    return (HALF - RADIUS) * (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])) + RADIUS
  }

  // State
  const orientation = new THREE.Quaternion()
  const place = new THREE.Vector3()
  let lift = 0
  let current = 0
  let motion: Motion | null = null
  let rockUntil = 0
  let rockAxis = new THREE.Vector3(1, 0, 0)
  let active = true
  let frame = 0
  let lastTime = performance.now()

  // Holding and leaning
  let pressed = false
  let held = false
  let heldMoved = 0
  const heldTarget = new THREE.Vector3()
  const grabOffset = new THREE.Vector3()
  const lastGround = new THREE.Vector3()
  const velocity = new THREE.Vector3()
  let lastMoveTime = 0
  const lean = new THREE.Vector2()
  const leanTarget = new THREE.Vector2()

  const raycaster = new THREE.Raycaster()
  const table = new THREE.Plane(UP, 0)
  const ground = new THREE.Vector3()
  const pointer = new THREE.Vector2()

  function groundAt(x: number, y: number) {
    const rect = canvas.getBoundingClientRect()
    pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    return raycaster.ray.intersectPlane(table, ground) ? ground : null
  }

  function throwTo(config: {
    face: number
    from: THREE.Vector3
    to: THREE.Vector3
    height: number
    speed: number
    quarters: number
    direction?: THREE.Vector3
    notify: boolean
    /** Set down where it is, without a tumble. */
    gentle?: boolean
  }) {
    const end = config.gentle
      ? nearestResting(config.face, orientation)
      : restingFor(config.face, Math.floor(Math.random() * 4))
    if (reducedMotion) {
      orientation.copy(end)
      place.copy(config.to)
      lift = 0
      motion = null
      current = config.face
      if (config.notify) options.onSettle(config.face)
      return
    }
    const travel = config.to.clone().sub(config.from).setY(0)
    const direction =
      travel.lengthSq() > 0.04
        ? travel.normalize()
        : (config.direction?.clone().setY(0).normalize() ??
          new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize())
    const flight = plan(config.height, config.speed)
    const axis = new THREE.Vector3().crossVectors(UP, direction).normalize()
    const angle = config.gentle ? 0 : config.quarters * (Math.PI / 2) + (Math.random() - 0.5) * 0.6
    const spin = config.gentle ? 0 : (Math.random() - 0.5) * 2.4
    const pathStart = end
      .clone()
      .premultiply(new THREE.Quaternion().setFromAxisAngle(UP, -spin))
      .premultiply(new THREE.Quaternion().setFromAxisAngle(axis, -angle))
    motion = {
      kind: 'throw',
      start: performance.now(),
      duration: flight.duration + 0.32,
      hops: flight.hops,
      from: config.from.clone(),
      to: config.to.clone(),
      axis,
      angle,
      spin,
      end,
      correction: pathStart.invert().multiply(orientation),
      blend: config.gentle ? 1 : 0.45,
      face: config.face,
      notify: config.notify,
    }
    rockAxis = axis.clone()
  }

  function randomFace() {
    let next = Math.floor(Math.random() * 5)
    if (next >= current) next += 1
    return next
  }

  function roll() {
    const to = new THREE.Vector3((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.7)
    throwTo({ face: randomFace(), from: place.clone(), to, height: lift, speed: 10.5, quarters: 4 + Math.floor(Math.random() * 3), notify: true })
  }

  function dropIn() {
    throwTo({
      face: Math.floor(Math.random() * 6),
      from: new THREE.Vector3(-3.4, 0, -2.4),
      to: new THREE.Vector3(0, 0, 0),
      height: 4,
      speed: 1,
      quarters: 6 + Math.floor(Math.random() * 3),
      notify: true,
    })
  }

  function flipTo(face: number, liftBy: number, notify: boolean) {
    const end = nearestResting(face, orientation)
    if (reducedMotion) {
      orientation.copy(end)
      current = face
      if (notify) options.onSettle(face)
      return
    }
    motion = { kind: 'flip', start: performance.now(), duration: 0.62, from: orientation.clone(), end, lift: liftBy, face, notify }
    rockAxis = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
  }

  const twist = new THREE.Quaternion()
  const spinTurn = new THREE.Quaternion()
  const fix = new THREE.Quaternion()
  const IDENTITY = new THREE.Quaternion()

  function finish(done: Motion, now: number) {
    orientation.copy(done.end)
    if (done.kind === 'throw') place.copy(done.to)
    lift = 0
    motion = null
    current = done.face
    rockUntil = now + ROCK * 1000
    if (done.notify) options.onSettle(done.face)
  }

  function updateMotion(now: number) {
    if (!motion) return
    const elapsed = (now - motion.start) / 1000
    const u = clamp(elapsed / motion.duration, 0, 1)
    if (motion.kind === 'throw') {
      // Roll and spin come out fast and ease to a stop on the chosen face.
      const left = Math.pow(1 - u, 3)
      twist.setFromAxisAngle(motion.axis, -motion.angle * left)
      spinTurn.setFromAxisAngle(UP, -motion.spin * left)
      orientation.copy(motion.end).premultiply(spinTurn).premultiply(twist)
      const w = clamp(u / motion.blend, 0, 1)
      orientation.multiply(fix.slerpQuaternions(motion.correction, IDENTITY, w * w * (3 - 2 * w)))
      const glide = 1 - Math.pow(1 - clamp(u / 0.92, 0, 1), 2.2)
      place.lerpVectors(motion.from, motion.to, glide)
      lift = heightAt(motion.hops, elapsed)
    } else {
      const eased = 1 - Math.pow(1 - u, 3)
      orientation.slerpQuaternions(motion.from, motion.end, eased)
      lift = motion.lift * Math.sin(Math.PI * u)
    }
    if (u >= 1) finish(motion, now)
  }

  // The canvas is the top part of a taller, centred view: the stage frames
  // the die exactly as before, and the overhang above it is extra sky.
  const overhang = options.overhang ?? 0
  function resize() {
    const parent = canvas.parentElement
    if (!parent) return
    const width = Math.max(1, parent.clientWidth)
    const height = Math.max(1, parent.clientHeight)
    const full = height * (1 + 2 * overhang)
    const shown = height * (1 + overhang)
    renderer.setSize(width, shown, false)
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((1 + 2 * overhang) * Math.tan(THREE.MathUtils.degToRad(FOV / 2))))
    camera.aspect = width / full
    if (overhang) camera.setViewOffset(width, full, 0, 0, width, shown)
    camera.updateProjectionMatrix()
  }

  function wake() {
    if (frame || !active) return
    lastTime = performance.now()
    frame = requestAnimationFrame(tick)
  }

  const resizeObserver = new ResizeObserver(() => {
    resize()
    wake()
  })
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement)
  resize()

  const shown = new THREE.Quaternion()
  const leanTurn = new THREE.Quaternion()
  const leanAxis = new THREE.Vector3()

  function tick(now: number) {
    frame = 0
    if (!active) return
    const dt = Math.min(0.05, (now - lastTime) / 1000)
    lastTime = now

    if (held) {
      lift = damp(lift, LIFT, 14, dt)
      place.x = damp(place.x, heldTarget.x, 16, dt)
      place.z = damp(place.z, heldTarget.z, 16, dt)
    } else {
      updateMotion(now)
    }

    lean.x = damp(lean.x, held || motion ? 0 : leanTarget.x, 9, dt)
    lean.y = damp(lean.y, held || motion ? 0 : leanTarget.y, 9, dt)

    shown.copy(orientation)
    // Settling rock after a landing, about the axis it was rolling on.
    let rocking = false
    if (!motion && !held && now < rockUntil) {
      const s = 1 - (rockUntil - now) / (ROCK * 1000)
      const angle = 0.07 * Math.exp(-6 * s) * Math.sin(s * 26)
      shown.premultiply(leanTurn.setFromAxisAngle(rockAxis, angle))
      rocking = true
    }
    if (Math.abs(lean.x) + Math.abs(lean.y) > 0.0005) {
      leanAxis.set(lean.y, 0, -lean.x)
      const amount = leanAxis.length()
      shown.premultiply(leanTurn.setFromAxisAngle(leanAxis.normalize(), amount))
    }

    const bottom = reach(shown)
    die.quaternion.copy(shown)
    die.position.set(place.x, bottom + lift, place.z)

    const air = lift + (bottom - HALF)
    const spread = 1 + air * 0.28
    // The key light is up and to the front left, so the shadow falls back
    // and to the right as the die rises.
    softShadow.position.set(place.x + air * 0.3, 0.001, place.z - air * 0.35)
    softShadow.scale.setScalar(SIZE * 1.9 * spread)
    ;(softShadow.material as THREE.MeshBasicMaterial).opacity = 0.62 / (1 + air * 0.7)
    contactShadow.position.set(place.x, 0.002, place.z)
    contactShadow.scale.setScalar(SIZE * 1.25)
    ;(contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.75 * clamp(1 - air * 2.2, 0, 1)

    renderer.render(scene, camera)

    const leaning =
      Math.abs(lean.x - (held || motion ? 0 : leanTarget.x)) + Math.abs(lean.y - (held || motion ? 0 : leanTarget.y)) > 0.0005
    const settlingHold =
      held && (Math.abs(lift - LIFT) > 0.001 || Math.abs(place.x - heldTarget.x) + Math.abs(place.z - heldTarget.z) > 0.001)
    if (motion || rocking || leaning || settlingHold) frame = requestAnimationFrame(tick)
  }

  // Compile shaders where the browser can do it in parallel, so the first
  // frame does not stall the page mid-scroll.
  await renderer.compileAsync(scene, camera).catch(() => undefined)

  if (reducedMotion) {
    orientation.copy(restingFor(0, 0))
    current = 0
    options.onSettle(0)
  } else {
    orientation.copy(restingFor(3, 1))
    place.set(-3.4, 0, -2.4)
    dropIn()
  }
  wake()

  return {
    roll() {
      if (held) return
      roll()
      wake()
    },
    showFace(face) {
      if (held) return
      flipTo(face, 0.9, true)
      wake()
    },
    pointerDown(x, y) {
      pressed = true
      const point = groundAt(x, y)
      if (!point || reducedMotion) return
      // Pick the die up from wherever it is, mid-air included.
      if (motion) {
        orientation.copy(die.quaternion)
        motion = null
      }
      held = true
      heldMoved = 0
      grabOffset.copy(place).sub(point).setY(0)
      heldTarget.copy(place)
      lastGround.copy(point)
      velocity.set(0, 0, 0)
      lastMoveTime = performance.now()
      wake()
    },
    pointerMove(x, y) {
      if (!held) return
      const point = groundAt(x, y)
      if (!point) return
      const now = performance.now()
      const delta = point.clone().sub(lastGround).setY(0)
      lastGround.copy(point)
      heldMoved += delta.length()
      const elapsed = Math.max(0.008, (now - lastMoveTime) / 1000)
      lastMoveTime = now
      velocity.lerp(delta.clone().divideScalar(elapsed), 0.45)
      heldTarget.copy(point).add(grabOffset).setY(0)
      const distance = Math.hypot(heldTarget.x, heldTarget.z)
      if (distance > REACH) heldTarget.multiplyScalar(REACH / distance)
      // Turn as if rolled along by the hand.
      if (delta.lengthSq() > 1e-6) {
        const axis = new THREE.Vector3().crossVectors(UP, delta).normalize()
        orientation.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, delta.length() / HALF))
      }
      wake()
    },
    pointerUp() {
      const wasPressed = pressed
      pressed = false
      if (!held) {
        // Without motion the die is never picked up; a press still rolls it.
        if (wasPressed && reducedMotion) roll()
        return
      }
      held = false
      const stale = performance.now() - lastMoveTime > 120
      const speed = stale ? 0 : velocity.length()
      if (heldMoved < 0.05) {
        roll()
      } else {
        const direction = speed > 0.5 ? velocity.clone().normalize() : undefined
        const to = direction
          ? place.clone().add(direction.clone().multiplyScalar(clamp(speed * 0.12, 0.2, 1))).setY(0)
          : place.clone().setY(0)
        const distance = Math.hypot(to.x, to.z)
        if (distance > REACH * 0.7) to.multiplyScalar((REACH * 0.7) / distance)
        throwTo({
          face: randomFace(),
          from: place.clone(),
          to,
          height: lift,
          speed: clamp(2 + speed * 0.5, 2, 9),
          quarters: Math.round(clamp(2 + speed * 0.45, 2, 9)),
          direction,
          notify: true,
        })
      }
      wake()
    },
    pointerCancel() {
      pressed = false
      if (!held) return
      held = false
      throwTo({ face: upFace(orientation), from: place.clone(), to: place.clone().setY(0), height: lift, speed: 0, quarters: 0, notify: true, gentle: true })
      wake()
    },
    hover(x, y) {
      if (held || reducedMotion) return
      const point = groundAt(x, y)
      if (!point) return
      // Lean a little toward the pointer, like it wants to be picked up.
      const dx = clamp((point.x - place.x) / 3, -1, 1)
      const dz = clamp((point.z - place.z) / 3, -1, 1)
      leanTarget.set(dx * 0.09, dz * 0.09)
      wake()
    },
    leave() {
      leanTarget.set(0, 0)
      wake()
    },
    setActive(value) {
      active = value
      if (value) {
        wake()
      } else {
        cancelAnimationFrame(frame)
        frame = 0
      }
    },
    dispose() {
      active = false
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      geometry.dispose()
      material.dispose()
      colorMap.dispose()
      heightMap.dispose()
      blob.dispose()
      shadowGeometry.dispose()
      ;(softShadow.material as THREE.Material).dispose()
      ;(contactShadow.material as THREE.Material).dispose()
      environment.dispose()
      renderer.dispose()
    },
  }
}
