export interface Settings {
  /** Suppress the clear pulse and other motion. Defaults from the OS. */
  reducedMotion: boolean
  /** Short vibration on place, clear and refusal, where the device supports it. */
  haptics: boolean
  /** Heavier outlines and darker shades, for sunlight and for low vision. */
  highContrast: boolean
  /** The progressive tutorial cards. */
  hints: boolean
  /** Render the dragged piece below the finger instead of above it. */
  leftHanded: boolean
}

const KEY = 'infill.settings.v1'

export function defaultSettings(): Settings {
  let reduced = false
  try {
    reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    reduced = false
  }
  return { reducedMotion: reduced, haptics: true, highContrast: false, hints: true, leftHanded: false }
}

export function loadSettings(): Settings {
  const base = defaultSettings()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<Settings>
    // Merge rather than replace, so a settings key added later gets its default
    // instead of coming back undefined for everyone who has already played.
    return { ...base, ...parsed }
  } catch {
    return base
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function buzz(settings: Settings, ms: number): void {
  if (!settings.haptics) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* not supported */
  }
}
