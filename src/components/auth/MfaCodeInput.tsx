"use client"

import { useRef, useCallback, type KeyboardEvent, type ClipboardEvent } from "react"
import { Input } from "@/components/ui/input"

interface MfaCodeInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  hasError?: boolean
}

/**
 * 6-digit MFA code input with auto-advance between digits.
 * Supports paste of full 6-digit code.
 */
export function MfaCodeInput({
  value,
  onChange,
  disabled = false,
  hasError = false,
}: MfaCodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, "").slice(0, 6).split("")

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < 6) {
      inputRefs.current[index]?.focus()
    }
  }, [])

  const handleChange = useCallback(
    (index: number, digit: string) => {
      // Only allow single digits
      const cleaned = digit.replace(/\D/g, "").slice(0, 1)
      const newDigits = [...digits]
      newDigits[index] = cleaned
      onChange(newDigits.join(""))

      if (cleaned && index < 5) {
        focusInput(index + 1)
      }
    },
    [digits, onChange, focusInput],
  )

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        focusInput(index - 1)
      }
      if (e.key === "ArrowLeft" && index > 0) {
        focusInput(index - 1)
      }
      if (e.key === "ArrowRight" && index < 5) {
        focusInput(index + 1)
      }
    },
    [digits, focusInput],
  )

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
      if (pasted.length > 0) {
        onChange(pasted.padEnd(6, "").slice(0, 6))
        focusInput(Math.min(pasted.length, 5))
      }
    },
    [onChange, focusInput],
  )

  return (
    <div className="flex items-center justify-center gap-2">
      {digits.map((digit, index) => (
        <div key={index} className="flex items-center">
          {index === 3 && <div className="mx-1 w-2 text-center text-muted-foreground">-</div>}
          <Input
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit === " " ? "" : digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`h-12 w-10 text-center text-lg font-mono sm:h-14 sm:w-12 ${
              hasError ? "border-destructive" : ""
            }`}
            aria-label={`Digito ${index + 1}`}
          />
        </div>
      ))}
    </div>
  )
}
