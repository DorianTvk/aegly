import type { Tone } from "@/components/ui/primitives";

export const BOOKING_STATUS: Record<string, { label: string; tone: Tone }> = {
  HELD: { label: "Aeg hoitud", tone: "info" },
  PENDING_PAYMENT: { label: "Ootab ettemaksu", tone: "warn" },
  CONFIRMED: { label: "Kinnitatud", tone: "ok" },
  COMPLETED: { label: "Lõpetatud", tone: "neutral" },
  CANCELLED: { label: "Tühistatud", tone: "bad" },
  NO_SHOW: { label: "Ei ilmunud", tone: "bad" },
};
