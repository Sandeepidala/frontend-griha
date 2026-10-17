/**
 * The build animation's clock, shared by the 3D scene (which advances it every frame) and the
 * player's controls (which play, pause and seek it).
 */
export class BuildClock {
  time: number
  playing: boolean
  speed = 1
  /** The camera circles on its own until the viewer grabs it. */
  autoCamera = true
  /** While a video is recorded frame by frame, the scene follows the clock exactly, with no smoothing. */
  recording = false
  duration: number

  constructor(duration: number, time = 0, playing = true) {
    this.duration = duration
    this.time = time
    this.playing = playing
  }

  /** Moves the clock on while playing; true on the tick that reaches the end. */
  tick(delta: number) {
    if (!this.playing) return false
    // A long pause between frames (a background tab) shouldn't jump the build ahead.
    this.time = Math.min(this.duration, this.time + Math.min(delta, 0.1) * this.speed)
    if (this.time < this.duration) return false
    this.playing = false
    return true
  }

  play() {
    if (this.time >= this.duration) this.time = 0
    this.playing = true
  }

  pause() {
    this.playing = false
  }

  seek(time: number) {
    this.time = Math.min(this.duration, Math.max(0, time))
    this.playing = false
  }

  setSpeed(speed: number) {
    this.speed = speed
  }

  follow(auto: boolean) {
    this.autoCamera = auto
  }

  /** From the start, at normal speed, with the camera circling: how a recording runs. */
  restartForRecording() {
    this.time = 0
    this.speed = 1
    this.autoCamera = true
    this.playing = true
  }

  /** A frame-by-frame recording sets the time itself, frame by frame. */
  beginRecording() {
    this.restartForRecording()
    this.playing = false
    this.recording = true
  }

  endRecording() {
    this.recording = false
  }
}
