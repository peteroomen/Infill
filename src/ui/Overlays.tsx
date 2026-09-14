import type { State } from '../game/types'
import type { Tip } from '../game/tips'
import type { Settings } from '../settings'

export function PauseButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="pause-btn" onClick={onClick} aria-label="Menu">
      <span />
      <span />
      <span />
    </button>
  )
}

export function TipCard({ tip, onDismiss }: { tip: Tip; onDismiss: () => void }) {
  return (
    <div className="tip" role="status">
      <div className="tip-body">
        <h2>{tip.title}</h2>
        <p>{tip.body}</p>
      </div>
      <button onClick={onDismiss} aria-label="Got it">
        Got it
      </button>
    </div>
  )
}

interface MenuProps {
  state: State
  best: number
  settings: Settings
  onSettings: (next: Settings) => void
  onResume: () => void
  onRestart: () => void
}

export function PauseMenu({ state, best, settings, onSettings, onResume, onRestart }: MenuProps) {
  const toggle = (key: keyof Settings) => () => onSettings({ ...settings, [key]: !settings[key] })
  return (
    <div className="sheet" role="dialog" aria-label="Menu">
      <div className="sheet-card">
        <p className="eyebrow">Paused</p>
        <dl className="stats">
          <div><dt>Population</dt><dd>{state.population.toLocaleString()}</dd></div>
          <div><dt>Placements</dt><dd>{state.placements}</dd></div>
          <div><dt>Best</dt><dd>{best.toLocaleString()}</dd></div>
        </dl>

        <h3>Settings</h3>
        <ul className="toggles">
          <Toggle label="Hints" hint="Explain each rule the first time it matters" on={settings.hints} onChange={toggle('hints')} />
          <Toggle label="Reduced motion" hint="No flash when a line is harvested" on={settings.reducedMotion} onChange={toggle('reducedMotion')} />
          <Toggle label="High contrast" hint="Wider steps between density levels" on={settings.highContrast} onChange={toggle('highContrast')} />
          <Toggle label="Haptics" hint="A short buzz on place and harvest" on={settings.haptics} onChange={toggle('haptics')} />
          <Toggle label="Drag below finger" hint="For left-handed play" on={settings.leftHanded} onChange={toggle('leftHanded')} />
        </ul>

        <div className="sheet-actions">
          <button className="primary" onClick={onResume}>Resume</button>
          <button
            className="ghost"
            onClick={() => {
              if (state.placements === 0 || confirm('Abandon this plan and start over?')) onRestart()
            }}
          >
            New plan
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string
  hint: string
  on: boolean
  onChange: () => void
}) {
  const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <li>
      <label htmlFor={id}>
        <span className="t-label">{label}</span>
        <span className="t-hint">{hint}</span>
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={on}
        className={`switch${on ? ' on' : ''}`}
        onClick={onChange}
      >
        <span />
      </button>
    </li>
  )
}

export function GameOver({
  state,
  best,
  isBest,
  onRestart,
}: {
  state: State
  best: number
  isBest: boolean
  onRestart: () => void
}) {
  const density = state.skyline.reduce((a, e) => a + e.density, 0)
  return (
    <div className="sheet" role="dialog" aria-label="Run over">
      <div className="sheet-card">
        <p className="eyebrow">{isBest ? 'A new best' : 'Buildout complete'}</p>
        <h1>{state.population.toLocaleString()}</h1>
        <p className="sub">population</p>
        <dl className="stats">
          <div><dt>Placements</dt><dd>{state.placements}</dd></div>
          <div><dt>Lines</dt><dd>{state.lines}</dd></div>
          <div><dt>Blight</dt><dd>{state.blightEvents}</dd></div>
          <div><dt>Storeys</dt><dd>{density}</dd></div>
        </dl>
        {!isBest && best > 0 && <p className="best">Best {best.toLocaleString()}</p>}
        <div className="sheet-actions">
          <button className="primary" onClick={onRestart}>New plan</button>
        </div>
      </div>
    </div>
  )
}
