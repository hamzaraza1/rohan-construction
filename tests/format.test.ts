import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "@/lib/format";

describe("formatting", () => {
  it("formats PKR amounts", () => {
    expect(formatMoney(2500000)).toBe("Rs. 2,500,000");
    expect(formatMoney("1234.5")).toBe("Rs. 1,234.5");
    expect(formatMoney(-50000)).toBe("-Rs. 50,000");
    expect(formatMoney(null)).toBe("Rs. 0");
  });
  it("formats DATE columns without timezone shift", () => {
    expect(formatDate(new Date("2026-11-09T00:00:00Z"))).toBe("09 Nov 2026");
    expect(formatDate(null)).toBe("—");
  });
});
