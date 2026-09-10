/**
 * Tests for timezone handling in schedule operations.
 *
 * The agenda operates in Brazil time (America/Sao_Paulo).
 * The database stores timestamptz in UTC.
 * All conversions must be explicit — never depend on server timezone.
 *
 * A reminder "1h before" calculated with wrong timezone arrives
 * at the wrong time. A conflict check with wrong timezone schedules
 * two patients at the same slot.
 */
import { describe, it, expect } from "vitest"
import {
  formatTimeBR,
  getEndTimeBR,
  formatDateBR,
} from "@/hooks/useSchedule"

describe("formatTimeBR — explicit Brazil timezone", () => {
  it("formats UTC midnight as Brazil time (21:00 or 20:00 depending on DST)", () => {
    // 2026-09-10T00:00:00Z = Sep 10, midnight UTC
    // Brazil Standard Time (BRT) = UTC-3
    // So midnight UTC = 21:00 BRT on Sep 9
    const result = formatTimeBR("2026-09-10T00:00:00Z")
    expect(result).toBe("21:00")
  })

  it("formats a standard Brazil business hour correctly", () => {
    // 2026-09-10T17:00:00Z = 14:00 BRT
    const result = formatTimeBR("2026-09-10T17:00:00Z")
    expect(result).toBe("14:00")
  })

  it("formats noon UTC as 09:00 BRT", () => {
    const result = formatTimeBR("2026-09-10T12:00:00Z")
    expect(result).toBe("09:00")
  })
})

describe("getEndTimeBR — calculates end time in Brazil timezone", () => {
  it("adds 50 minutes to session start", () => {
    // 14:00 BRT + 50min = 14:50 BRT
    const result = getEndTimeBR("2026-09-10T17:00:00Z", 50)
    expect(result).toBe("14:50")
  })

  it("handles crossing the hour boundary", () => {
    // 09:30 BRT + 50min = 10:20 BRT
    const result = getEndTimeBR("2026-09-10T12:30:00Z", 50)
    expect(result).toBe("10:20")
  })
})

describe("formatDateBR — formats date in Brazil timezone", () => {
  it("formats a date correctly", () => {
    // 2026-09-10 in Brazil time
    const result = formatDateBR(new Date("2026-09-10T15:00:00Z"))
    expect(result).toBe("2026-09-10")
  })

  it("handles midnight UTC crossing day boundary in Brazil", () => {
    // 2026-09-11T02:00:00Z = 2026-09-10T23:00:00 BRT
    // Should show Sep 10 in Brazil time, not Sep 11
    const result = formatDateBR(new Date("2026-09-11T02:00:00Z"))
    expect(result).toBe("2026-09-10")
  })
})
