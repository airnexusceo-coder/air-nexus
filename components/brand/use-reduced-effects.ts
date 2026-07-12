'use client'

import { useEffect, useState } from 'react'

/**
 * Coarse "low power device" signal used to simplify decorative brand
 * animation, independent of the OS reduce-motion setting (which the CSS
 * already handles on its own via media queries).
 */
export function useReducedEffects() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const narrowQuery = window.matchMedia('(max-width: 640px)')
    const cores = navigator.hardwareConcurrency ?? 8

    const evaluate = () => setReduced(motionQuery.matches || narrowQuery.matches || cores <= 4)
    evaluate()

    motionQuery.addEventListener('change', evaluate)
    narrowQuery.addEventListener('change', evaluate)
    return () => {
      motionQuery.removeEventListener('change', evaluate)
      narrowQuery.removeEventListener('change', evaluate)
    }
  }, [])

  return reduced
}
