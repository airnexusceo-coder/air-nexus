import { compileExpression } from './expression'

/** Pure SVG-path plotting logic, extracted so both the Calculators page and AI-generated chat graphs can share one implementation. */

export type FunctionPath = { path: string; color: string; error?: string }

export const PLOT_COLORS = ['#ffffff', '#a1a1aa', '#71717a', '#38bdf8']

export function buildFunctionPaths(
  expressions: string[],
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  width = 640,
  height = 320,
): FunctionPath[] {
  const { xMin, xMax, yMin, yMax } = bounds
  return expressions.map((expression, index) => {
    const color = PLOT_COLORS[index % PLOT_COLORS.length]
    try {
      const evaluate = compileExpression(expression)
      const segments: string[] = []
      let drawing = false
      for (let pixel = 0; pixel <= width; pixel += 2) {
        const x = xMin + (pixel / width) * (xMax - xMin)
        const y = evaluate(x)
        const screenY = height - ((y - yMin) / (yMax - yMin)) * height
        const valid = Number.isFinite(screenY) && screenY > -height * 1.5 && screenY < height * 2.5
        if (valid) {
          segments.push((drawing ? 'L' : 'M') + pixel.toFixed(1) + ' ' + screenY.toFixed(1))
          drawing = true
        } else {
          drawing = false
        }
      }
      return { path: segments.join(' '), color }
    } catch (error) {
      return { path: '', color, error: error instanceof Error ? error.message : 'Invalid expression' }
    }
  })
}

/** Samples one function into raw {x,y} points for chart libraries (Recharts) that want data arrays rather than a pre-built SVG path. Non-finite results are dropped so a chart never tries to plot Infinity/NaN. */
export function sampleFunctionPoints(expression: string, xMin: number, xMax: number, steps = 200): { x: number; y: number }[] {
  const evaluate = compileExpression(expression)
  const points: { x: number; y: number }[] = []
  for (let step = 0; step <= steps; step += 1) {
    const x = xMin + (step / steps) * (xMax - xMin)
    const y = evaluate(x)
    if (Number.isFinite(y)) points.push({ x, y })
  }
  return points
}

/** Samples every function across [xMin, xMax] to pick a y-range that actually shows the interesting part of the curve, instead of a fixed guess. */
export function autoFitYBounds(expressions: string[], xMin: number, xMax: number): { yMin: number; yMax: number } {
  const samples: number[] = []
  for (const expression of expressions) {
    try {
      const evaluate = compileExpression(expression)
      for (let step = 0; step <= 100; step += 1) {
        const x = xMin + (step / 100) * (xMax - xMin)
        const y = evaluate(x)
        if (Number.isFinite(y)) samples.push(y)
      }
    } catch {
      // Skip functions that fail to compile — buildFunctionPaths reports the error separately.
    }
  }
  if (samples.length === 0) return { yMin: -10, yMax: 10 }
  let min = Math.min(...samples)
  let max = Math.max(...samples)
  if (min === max) {
    min -= 1
    max += 1
  }
  const padding = (max - min) * 0.15
  return { yMin: min - padding, yMax: max + padding }
}
