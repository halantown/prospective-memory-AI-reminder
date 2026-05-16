import { useState } from 'react'
import { ALL_SOUND_NAMES, isFileBackedSound, useSoundEffects, type SoundName } from '../../hooks/useSoundEffects'

export default function SoundPreviewPage() {
  const play = useSoundEffects()
  const [lastPlayed, setLastPlayed] = useState<string | null>(null)

  const handlePlay = (name: SoundName) => {
    play(name)
    setLastPlayed(name)
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-slate-500 mb-6">Click any sound to play it. File-backed sounds show a badge.</p>

        <div className="grid gap-2">
          {ALL_SOUND_NAMES.map((name) => (
            <button
              key={name}
              onClick={() => handlePlay(name)}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition
                ${lastPlayed === name
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
            >
              <span className="font-mono text-sm text-slate-800">{name}</span>
              {isFileBackedSound(name) && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  mp3
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
