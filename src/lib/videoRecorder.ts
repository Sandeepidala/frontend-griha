/**
 * Records a canvas to a video file in the browser (MediaRecorder): MP4 where the browser can make
 * it (Chrome, Edge, Safari), WebM otherwise (Firefox). Nothing is uploaded.
 */

export interface VideoFormat {
  mimeType: string
  extension: 'mp4' | 'webm'
}

const CANDIDATES: VideoFormat[] = [
  { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
]

/** The best video format this browser can record, or null when it can't record video at all. */
export function videoFormat(): VideoFormat | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return null
  return CANDIDATES.find((f) => MediaRecorder.isTypeSupported(f.mimeType)) ?? null
}

export interface CanvasRecording {
  /** Finishes the recording and resolves with the video. */
  stop: () => Promise<Blob>
  /** Throws the recording away. */
  cancel: () => void
}

export function recordCanvas(canvas: HTMLCanvasElement, format: VideoFormat, fps = 30): CanvasRecording {
  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.start(250)
  const stopTracks = () => stream.getTracks().forEach((track) => track.stop())
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stopTracks()
          resolve(new Blob(chunks, { type: format.mimeType.split(';')[0] }))
        }
        recorder.stop()
      }),
    cancel: () => {
      recorder.onstop = stopTracks
      if (recorder.state !== 'inactive') recorder.stop()
    },
  }
}

export interface FrameRecorder {
  extension: 'mp4' | 'webm'
  /** Encodes the canvas as it is now, as the frame at `time` (seconds) lasting `duration`. */
  addFrame: (time: number, duration: number) => Promise<void>
  finish: () => Promise<Blob>
  cancel: () => Promise<void>
}

/**
 * Encodes a canvas frame by frame with exact timestamps (WebCodecs, through Mediabunny), so the video
 * plays at the right speed however slowly the frames were drawn. H.264 in MP4 where the browser can
 * encode it, else VP9 in WebM; null when it can't do either (then fall back to `recordCanvas`).
 */
export async function createFrameRecorder(canvas: HTMLCanvasElement, fps: number): Promise<FrameRecorder | null> {
  if (typeof VideoEncoder === 'undefined') return null
  // Loaded only when someone records.
  const mb = await import('mediabunny')
  const quality = new mb.Quality('high')
  const choices = [
    { codec: 'avc' as const, extension: 'mp4' as const, mime: 'video/mp4', format: () => new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) },
    { codec: 'vp9' as const, extension: 'webm' as const, mime: 'video/webm', format: () => new mb.WebMOutputFormat() },
  ]
  for (const choice of choices) {
    if (!(await mb.canEncodeVideo(choice.codec, { width: canvas.width, height: canvas.height, quality }))) continue
    const target = new mb.BufferTarget()
    const output = new mb.Output({ format: choice.format(), target })
    const source = new mb.CanvasSource(canvas, { codec: choice.codec, quality })
    output.addVideoTrack(source, { frameRate: fps })
    await output.start()
    return {
      extension: choice.extension,
      addFrame: (time, duration) => source.add(time, duration),
      finish: async () => {
        await output.finalize()
        return new Blob([target.buffer!], { type: choice.mime })
      },
      cancel: () => output.cancel(),
    }
  }
  return null
}

/** Saves a file through the browser's download. */
export function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
