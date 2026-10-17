import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { Clapperboard, Download, Pause, Play, RotateCcw, Video, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { type BoqEstimate, formatLakhs } from '@/lib/boq'
import { cn } from '@/lib/cn'
import { type BuildSequence, constructionSequence, spentAt, stageAt, weekAt } from '@/lib/drawings/construction'
import { createFrameRecorder, recordCanvas, saveFile, videoFormat } from '@/lib/videoRecorder'
import { toast } from '@/stores/useToastStore'
import type { ProjectBrief } from '@/types/brief'
import type { Floor, Plot } from '@/types/design'
import { BuildClock } from './buildClock'
import { BuildScene } from './BuildScene'

const VIDEO_WIDTH = 1280
const VIDEO_HEIGHT = 720
const VIDEO_FPS = 30

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const sizeMb = (blob: Blob) => Math.round(blob.size / 104_857.6) / 10

const clock2 = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const months = (weeks: number) => Math.max(1, Math.round(weeks / 4.35))

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'griha-house'
}

/** Wraps text onto lines no wider than `width`, for the video's captions. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

/** One video frame: the 3D view filling 16:9, with the stage, week and spend burnt in. */
function drawVideoFrame(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, sequence: BuildSequence, time: number, projectName: string) {
  const W = VIDEO_WIDTH
  const H = VIDEO_HEIGHT
  const scale = Math.max(W / source.width, H / source.height)
  const dw = source.width * scale
  const dh = source.height * scale
  ctx.fillStyle = '#dfe9f3'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(source, (W - dw) / 2, (H - dh) / 2, dw, dh)

  const shade = (y0: number, y1: number, from: number, to: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1)
    g.addColorStop(0, `rgba(15,17,21,${from})`)
    g.addColorStop(1, `rgba(15,17,21,${to})`)
    ctx.fillStyle = g
    ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0))
  }
  shade(0, 190, 0.62, 0)
  shade(H - 130, H, 0, 0.62)

  const font = getComputedStyle(document.body).fontFamily || 'sans-serif'
  const stage = stageAt(sequence, time)
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = `600 15px ${font}`
  ctx.fillText(`WEEK ${weekAt(sequence, time)} OF ${sequence.totalWeeks} · INDICATIVE`, 40, 34)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 34px ${font}`
  ctx.fillText(stage?.title ?? '', 40, 58)
  ctx.font = `400 18px ${font}`
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  wrap(ctx, stage?.detail ?? '', 700).forEach((line, i) => ctx.fillText(line, 40, 104 + i * 25))

  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 26px ${font}`
  ctx.fillText('Griha', W - 40, 34)
  if (projectName) {
    ctx.font = `400 16px ${font}`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(projectName, W - 40, 68)
  }
  ctx.font = `400 13px ${font}`
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Indicative schedule and costs, for planning only', W - 40, H - 34)
  ctx.textAlign = 'left'

  if (sequence.totalCost) {
    const spent = spentAt(sequence, time)
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 18px ${font}`
    ctx.fillText(`Spent so far ${formatLakhs(spent)} of ${formatLakhs(sequence.totalCost)}`, 40, H - 58)
    const barW = 420
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.fillRect(40, H - 44, barW, 8)
    ctx.fillStyle = '#7cc48a'
    ctx.fillRect(40, H - 44, barW * Math.min(1, spent / sequence.totalCost), 8)
  }
}

interface BuildSequenceDialogProps {
  onClose: () => void
  /** e.g. "Option B" or the project's name. */
  title: string
  projectName: string
  plot: Plot
  floors: Floor[]
  brief: ProjectBrief | null
  estimate: BoqEstimate | null
  /** A main action beside Close, e.g. choosing this layout. */
  action?: { label: string; onClick: () => void }
}

/**
 * "Watch it get built": the chosen layout going up stage by stage, from marking out the plot to the
 * garden, with the indicative week and the money spent so far; downloadable as a video to share.
 */
export function BuildSequenceDialog({ onClose, title, projectName, plot, floors, brief, estimate, action }: BuildSequenceDialogProps) {
  const sequence = useMemo(() => constructionSequence({ plot, floors, brief, estimate }), [plot, floors, brief, estimate])
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // With reduced motion, open on the finished house and let the viewer press play.
  const startTime = reducedMotion ? sequence.duration : 0
  const [clock] = useState(() => new BuildClock(sequence.duration, startTime, !reducedMotion))
  const [time, setTime] = useState(startTime)
  const [playing, setPlaying] = useState(!reducedMotion)
  const [speed, setSpeed] = useState(1)
  const [autoCamera, setAutoCamera] = useState(true)
  const [recording, setRecording] = useState(false)
  // How much of a frame-by-frame recording is done (0–1) and the seconds it has left; null for a real-time one.
  const [recorded, setRecorded] = useState<{ done: number; left: number | null } | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const glCanvas = useRef<HTMLCanvasElement | null>(null)
  // The recording under way; `cancelled` stops it at its next frame.
  const job = useRef<{ cancelled: boolean } | null>(null)
  const canRecord = useMemo(() => typeof VideoEncoder !== 'undefined' || videoFormat() !== null, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // The controls show the clock a few times a second; the scene reads it every frame.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(clock.time)
      setPlaying(clock.playing)
    }, 100)
    return () => window.clearInterval(timer)
  }, [clock])

  const cancelRecording = useCallback(() => {
    if (job.current) job.current.cancelled = true
  }, [])
  useEffect(() => cancelRecording, [cancelRecording])

  function play() {
    clock.play()
    setPlaying(true)
  }
  function pause() {
    clock.pause()
    setPlaying(false)
  }
  function restart() {
    clock.seek(0)
    play()
  }
  function seek(value: number) {
    clock.seek(value)
    setTime(value)
    setPlaying(false)
  }
  function changeSpeed(value: number) {
    clock.setSpeed(value)
    setSpeed(value)
  }
  function followCamera() {
    clock.follow(true)
    setAutoCamera(true)
  }

  async function startRecording() {
    const source = glCanvas.current
    if (!source || job.current) return
    const out = document.createElement('canvas')
    out.width = VIDEO_WIDTH
    out.height = VIDEO_HEIGHT
    const ctx = out.getContext('2d')
    if (!ctx) return
    const current = { cancelled: false }
    job.current = current
    // A recording always runs from the start, at normal speed, with the camera circling.
    setSpeed(1)
    setAutoCamera(true)
    setRecording(true)
    const fileName = (extension: string) => `${slug(projectName || title)}-construction.${extension}`
    try {
      const frames = await createFrameRecorder(out, VIDEO_FPS)
      if (frames) {
        // Frame by frame: each frame is drawn at its exact time, so the video plays at the right speed
        // however slowly this device draws.
        clock.beginRecording()
        setRecorded({ done: 0, left: null })
        const count = Math.ceil(sequence.duration * VIDEO_FPS)
        const began = performance.now()
        await nextFrame()
        for (let i = 0; i <= count; i++) {
          if (current.cancelled) break
          const t = Math.min(sequence.duration, i / VIDEO_FPS)
          clock.seek(t)
          await nextFrame()
          if (i === 0) await nextFrame()
          drawVideoFrame(ctx, source, sequence, t, projectName)
          await frames.addFrame(i / VIDEO_FPS, 1 / VIDEO_FPS)
          if (i % 6 === 0 && i > 0) {
            const done = i / count
            setRecorded({ done, left: ((performance.now() - began) / 1000) * ((1 - done) / done) })
          }
        }
        if (current.cancelled) {
          await frames.cancel()
          return
        }
        const blob = await frames.finish()
        saveFile(blob, fileName(frames.extension))
        toast.success(`Video saved (${frames.extension.toUpperCase()}, ${sizeMb(blob)} MB)`)
        return
      }
      // Without WebCodecs: record in real time while it plays.
      const format = videoFormat()
      if (!format) throw new Error("this browser can't record video")
      clock.restartForRecording()
      const recording = recordCanvas(out, format)
      while (!current.cancelled && clock.time < sequence.duration) {
        drawVideoFrame(ctx, source, sequence, clock.time, projectName)
        await nextFrame()
      }
      drawVideoFrame(ctx, source, sequence, clock.time, projectName)
      if (current.cancelled) {
        recording.cancel()
        return
      }
      const blob = await recording.stop()
      saveFile(blob, fileName(format.extension))
      toast.success(`Video saved (${format.extension.toUpperCase()}, ${sizeMb(blob)} MB)`)
    } catch (err) {
      toast.danger(`Couldn't make the video: ${err instanceof Error ? err.message : 'something went wrong'}.`)
    } finally {
      clock.endRecording()
      job.current = null
      setRecording(false)
      setRecorded(null)
    }
  }

  const stage = stageAt(sequence, time)
  const spent = spentAt(sequence, time)
  const total = sequence.totalCost
  const budget = sequence.budget

  return createPortal(
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      aria-label={`${title}: watch it get built`}
      className="m-0 h-svh max-h-none w-screen max-w-none bg-bg p-0 text-text backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2.5 sm:px-6">
          <Clapperboard className="size-5 shrink-0 text-text-muted" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-base font-semibold text-text">{title}: watch it get built</h2>
            <p className="truncate text-xs text-text-muted">
              About {months(sequence.totalWeeks)} months on site ({sequence.totalWeeks} weeks){total ? ` · ${formatLakhs(total)}` : ''} · indicative, for planning only
            </p>
          </div>
          {action && (
            <Button size="sm" onClick={action.onClick} disabled={recording}>
              {action.label}
            </Button>
          )}
          <IconButton label="Close" variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </header>

        <div className="relative min-h-0 flex-1" data-testid="build-sequence">
          <Canvas
            shadows="percentage"
            dpr={[1, 2]}
            gl={{ preserveDrawingBuffer: true, antialias: true }}
            camera={{ fov: 40, near: 0.5, far: 3000, position: [0, 40, 80] }}
            onCreated={({ gl }) => {
              glCanvas.current = gl.domElement
            }}
          >
            <BuildScene
              sequence={sequence}
              clock={clock}
              onEnd={() => setPlaying(false)}
              onGrabCamera={() => {
                clock.follow(false)
                setAutoCamera(false)
              }}
            />
          </Canvas>

          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-3 sm:inset-x-4 sm:top-4">
            <section className="max-w-md rounded-lg bg-surface/95 px-4 py-3 shadow-md" aria-live="polite">
              <p className="text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                Week {weekAt(sequence, time)} of {sequence.totalWeeks}
              </p>
              <h3 className="font-display text-base font-semibold text-text">{stage?.title}</h3>
              <p className="mt-0.5 text-xs text-text-muted">{stage?.detail}</p>
            </section>
            {total ? (
              <section className="w-64 rounded-lg bg-surface/95 px-4 py-3 shadow-md">
                <p className="text-[11px] font-semibold tracking-wide text-text-muted uppercase">Spent so far</p>
                <p className="font-mono text-lg font-semibold tabular-nums text-text">
                  {formatLakhs(spent)} <span className="text-xs font-normal text-text-muted">of {formatLakhs(total)}</span>
                </p>
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, (spent / total) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-text-faint">
                  {stage && stage.cost > 0 ? `This stage: ${formatLakhs(stage.cost)}` : 'Not in the estimate'}
                  {budget ? ` · budget ${formatLakhs(budget)}` : ''}
                </p>
              </section>
            ) : null}
          </div>

          {!autoCamera && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
              <Button size="sm" variant="outline" leftIcon={<Video className="size-4" />} onClick={followCamera} className="bg-surface/95 shadow-md">
                Follow the camera again
              </Button>
            </div>
          )}
          {recording && (
            <div className="absolute right-3 bottom-3 flex items-center gap-2 rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white shadow-md">
              <span className="size-2 animate-pulse rounded-full bg-white" />
              {recorded === null
                ? `Recording ${clock2(time)} / ${clock2(sequence.duration)}`
                : `Making the video… ${Math.round(recorded.done * 100)}%${recorded.left !== null && recorded.done > 0.05 ? ` · about ${recorded.left < 60 ? `${Math.max(1, Math.round(recorded.left))} s` : `${Math.round(recorded.left / 60)} min`} left` : ''}`}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-surface px-4 py-3 sm:px-6">
          {playing ? (
            <IconButton label="Pause" variant="outline" onClick={pause} disabled={recording}>
              <Pause className="size-4" />
            </IconButton>
          ) : (
            <IconButton label="Play" variant="outline" onClick={play} disabled={recording}>
              <Play className="size-4" />
            </IconButton>
          )}
          <IconButton label="Restart" variant="ghost" onClick={restart} disabled={recording}>
            <RotateCcw className="size-4" />
          </IconButton>
          <span className="font-mono text-xs tabular-nums text-text-muted">
            {clock2(time)} / {clock2(sequence.duration)}
          </span>
          <div className="relative order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex h-1 -translate-y-1/2" aria-hidden>
              {sequence.stages.map((s) => (
                <span
                  key={s.id}
                  title={s.title}
                  className={cn('h-full border-r border-surface', time >= s.end ? 'bg-primary/60' : time >= s.start ? 'bg-primary/35' : 'bg-border')}
                  style={{ width: `${((s.end - s.start) / sequence.duration) * 100}%` }}
                />
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={sequence.duration}
              step={0.01}
              value={time}
              onChange={(event) => seek(Number(event.target.value))}
              disabled={recording}
              aria-label="Build progress"
              className="relative w-full cursor-pointer accent-primary"
            />
          </div>
          <SegmentedControl
            value={String(speed)}
            onChange={(value) => changeSpeed(Number(value))}
            options={[
              { value: '1', label: '1×' },
              { value: '2', label: '2×' },
            ]}
          />
          {recording ? (
            <Button variant="outline" size="sm" onClick={cancelRecording}>
              Stop recording
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Download className="size-4" />}
              onClick={() => void startRecording()}
              disabled={!canRecord}
              title={canRecord ? `Saves the ${clock2(sequence.duration)} animation as a video to share` : "This browser can't make videos"}
            >
              Download video
            </Button>
          )}
        </footer>
      </div>
    </dialog>,
    document.body,
  )
}
