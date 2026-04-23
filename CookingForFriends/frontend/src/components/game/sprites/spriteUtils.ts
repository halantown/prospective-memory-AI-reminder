/**
 * Dynamic CSS @keyframes injection for spritesheet animations.
 *
 * Each unique frameCount × frameWidth combination gets one injected
 * @keyframes rule that slides background-position-x from 0 to -(N * fw)px.
 * The caller applies steps(N) in the animation shorthand to get discrete jumps.
 */

const injected = new Set<string>()

/**
 * Ensures a @keyframes rule exists for the given frame count and frame width,
 * injecting it into <head> once if needed.
 *
 * @returns The keyframe animation name to use in CSS `animation:` shorthand.
 */
export function ensureSpriteKeyframe(frameCount: number, frameW: number): string {
  const name = `sprite-${frameCount}-${frameW}`
  if (!injected.has(name)) {
    injected.add(name)
    const style = document.createElement('style')
    style.dataset.spriteKeyframe = name
    style.textContent = `@keyframes ${name} {
  from { background-position-x: 0px }
  to   { background-position-x: ${-(frameCount * frameW)}px }
}`
    document.head.appendChild(style)
  }
  return name
}
