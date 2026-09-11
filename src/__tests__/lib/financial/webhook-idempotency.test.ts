/**
 * B1 regression test: webhook idempotency key must be deterministic.
 *
 * The asaas_event_id must NOT include Date.now() or any non-deterministic
 * component. Given the same webhook payload delivered twice, the event ID
 * must be identical so that the PK constraint prevents reprocessing.
 *
 * This test validates the key derivation logic in isolation -- it does not
 * call the Edge Function (which runs in Deno, not Node).
 */

import { describe, it, expect } from "vitest"

/**
 * Port of the key derivation logic from asaas-webhook/index.ts.
 * If the Edge Function changes, this must be updated in sync.
 */
function deriveAsaasEventId(payload: {
  id?: string
  event?: string
  payment?: { id?: string }
}): string {
  const paymentId = payload.payment?.id
  const eventType = payload.event

  if (!paymentId || !eventType) {
    throw new Error("Cannot derive event ID without payment.id and event")
  }

  // Deterministic: use payload.id if available, else payment_id + event
  return payload.id
    ? String(payload.id)
    : `${paymentId}_${eventType}`
}

describe("webhook idempotency key derivation", () => {
  it("produces identical keys for the same payload delivered twice", () => {
    const payload = {
      id: "evt_abc123",
      event: "PAYMENT_RECEIVED",
      payment: { id: "pay_xyz789" },
    }

    const key1 = deriveAsaasEventId(payload)
    const key2 = deriveAsaasEventId(payload)

    expect(key1).toBe(key2)
    expect(key1).toBe("evt_abc123")
  })

  it("uses payload.id when available (Asaas event ID)", () => {
    const key = deriveAsaasEventId({
      id: "evt_unique_from_asaas",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_001" },
    })

    expect(key).toBe("evt_unique_from_asaas")
  })

  it("falls back to payment_id + event when payload.id is missing", () => {
    const key = deriveAsaasEventId({
      event: "PAYMENT_OVERDUE",
      payment: { id: "pay_002" },
    })

    expect(key).toBe("pay_002_PAYMENT_OVERDUE")
  })

  it("produces different keys for different event types on the same payment", () => {
    const key1 = deriveAsaasEventId({
      event: "PAYMENT_RECEIVED",
      payment: { id: "pay_003" },
    })

    const key2 = deriveAsaasEventId({
      event: "PAYMENT_OVERDUE",
      payment: { id: "pay_003" },
    })

    expect(key1).not.toBe(key2)
  })

  it("NEVER includes Date.now() or timestamp in the key", () => {
    // Run derivation 1000 times -- all must produce the same key
    const payload = {
      event: "PAYMENT_RECEIVED",
      payment: { id: "pay_stable" },
    }

    const keys = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      keys.add(deriveAsaasEventId(payload))
    }

    expect(keys.size).toBe(1)
  })

  it("throws when payment.id is missing", () => {
    expect(() =>
      deriveAsaasEventId({
        event: "PAYMENT_RECEIVED",
        payment: {},
      }),
    ).toThrow()
  })

  it("throws when event is missing", () => {
    expect(() =>
      deriveAsaasEventId({
        payment: { id: "pay_004" },
      }),
    ).toThrow()
  })
})
