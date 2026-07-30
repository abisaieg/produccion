import { useEffect, useRef, useState } from 'react'
import { entrarConPin } from '../lib/auth'

export function Pin({ onEntrar }: { onEntrar: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [probando, setProbando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { input.current?.focus() }, [])

  async function intentar(valor: string) {
    setProbando(true)
    setError(false)
    try {
      await entrarConPin(valor)
      onEntrar()
    } catch {
      setError(true)
      setPin('')
      setTimeout(() => input.current?.focus(), 100)
    } finally {
      setProbando(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center px-6">
      <div className="w-full max-w-xs text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Producción</h1>
        <p className="text-sm text-neutral-500 mt-1 mb-8">Ingresá el PIN para entrar</p>

        <input
          ref={input}
          type="tel"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          disabled={probando}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4)
            setPin(v)
            setError(false)
            if (v.length === 4) intentar(v)
          }}
          className={`w-full text-center text-3xl tracking-[0.6em] py-3 bg-white border-2 rounded-lg
                      focus:outline-none transition-colors
                      ${error ? 'border-red-500' : 'border-neutral-300 focus:border-neutral-900'}`}
          placeholder="••••"
          aria-label="PIN"
        />

        <p className={`text-sm mt-3 h-5 ${error ? 'text-red-600' : 'text-neutral-400'}`}>
          {probando ? 'Entrando…' : error ? 'PIN incorrecto' : ''}
        </p>
      </div>
    </div>
  )
}
