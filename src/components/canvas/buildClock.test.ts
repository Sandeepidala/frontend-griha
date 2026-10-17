import { describe, expect, it } from 'vitest'
import { BuildClock } from './buildClock'

describe('BuildClock', () => {
  it('runs at its speed, stops at the end and says so once', () => {
    const clock = new BuildClock(1)
    expect(clock.tick(0.05)).toBe(false)
    clock.setSpeed(2)
    expect(clock.tick(0.05)).toBe(false)
    expect(clock.time).toBeCloseTo(0.15, 9)
    for (let i = 0; i < 20 && !clock.tick(0.05); i++);
    expect(clock.time).toBe(1)
    expect(clock.playing).toBe(false)
    expect(clock.tick(0.05)).toBe(false)
  })

  it('does not jump ahead after a long gap between frames', () => {
    const clock = new BuildClock(10)
    clock.tick(5)
    expect(clock.time).toBeCloseTo(0.1, 9)
  })

  it('plays again from the start once finished, and seeks within the animation', () => {
    const clock = new BuildClock(3, 3, false)
    clock.play()
    expect(clock.time).toBe(0)
    expect(clock.playing).toBe(true)
    clock.seek(9)
    expect(clock.time).toBe(3)
    expect(clock.playing).toBe(false)
    clock.seek(-1)
    expect(clock.time).toBe(0)
  })

  it('records from the start at normal speed with the camera circling', () => {
    const clock = new BuildClock(5, 4, false)
    clock.setSpeed(2)
    clock.follow(false)
    clock.restartForRecording()
    expect([clock.time, clock.speed, clock.autoCamera, clock.playing]).toEqual([0, 1, true, true])
  })
})
