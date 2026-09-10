"use client"

/**
 * Reusable consent section with scrollable text and checkbox.
 *
 * @see wireframe B.02, B.03
 */

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AlertTriangle } from "lucide-react"

interface ConsentSectionProps {
  /** Title displayed above the text */
  title: string
  /** Whether this consent is required */
  required: boolean
  /** The full consent text (scrollable) */
  text: string
  /** Checkbox label */
  checkboxLabel: string
  /** Whether the checkbox is checked */
  checked: boolean
  /** Callback when checkbox state changes */
  onCheckedChange: (checked: boolean) => void
  /** Optional warning message */
  warning?: string
}

export function ConsentSection({
  title,
  required,
  text,
  checkboxLabel,
  checked,
  onCheckedChange,
  warning,
}: ConsentSectionProps) {
  const borderColor = required
    ? "border-l-primary"
    : "border-l-muted-foreground/30"

  return (
    <div
      className={`rounded-lg border border-border border-l-4 ${borderColor} p-4 space-y-3`}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
          {required && (
            <span className="ml-1 text-destructive">*</span>
          )}
          {!required && (
            <span className="ml-2 text-xs font-normal normal-case text-muted-foreground">
              (opcional)
            </span>
          )}
        </h3>
      </div>

      <div className="max-h-[300px] overflow-y-auto rounded bg-muted/30 p-3 text-sm leading-relaxed text-foreground/80">
        {text.split("\n").map((line, i) => (
          <p key={i} className={line.trim() === "" ? "h-3" : ""}>
            {line}
          </p>
        ))}
      </div>

      {warning && (
        <div className="flex items-start gap-2 rounded bg-warning/10 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground mt-0.5" />
          <p className="text-sm text-warning-foreground">{warning}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id={`consent-${title.toLowerCase().replace(/\s/g, "-")}`}
          checked={checked}
          onCheckedChange={(val) => onCheckedChange(val === true)}
        />
        <Label
          htmlFor={`consent-${title.toLowerCase().replace(/\s/g, "-")}`}
          className="text-sm font-medium cursor-pointer"
        >
          {checkboxLabel}
        </Label>
      </div>
    </div>
  )
}
