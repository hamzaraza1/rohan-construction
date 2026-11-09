import { describe, expect, it } from "vitest";
import { dateInput, money, optionalMoney, percent } from "@/lib/validation";
import { detectFileType } from "@/lib/file-types";

describe("money input", () => {
  const m = money();
  it("accepts common ways of typing amounts and returns an exact decimal string", () => {
    expect(m.parse("2,500,000")).toBe("2500000");
    expect(m.parse("Rs. 300000")).toBe("300000");
    expect(m.parse(" 1500.50 ")).toBe("1500.50");
  });
  it("rejects bad amounts", () => {
    for (const bad of ["", "0", "-5", "abc", "1.234", "12e5", "1,00,00,00,00,00,000"]) {
      expect(m.safeParse(bad).success, bad).toBe(false);
    }
  });
  it("optional money returns null when empty", () => {
    expect(optionalMoney().parse("")).toBeNull();
    expect(optionalMoney().parse("12,000")).toBe("12000");
  });
});

describe("percent input", () => {
  it("accepts 0 < x <= 100", () => {
    expect(percent().parse("10")).toBe("10");
    expect(percent().parse("12.5%")).toBe("12.5");
    for (const bad of ["0", "150", "-1", "abc", ""]) expect(percent().safeParse(bad).success, bad).toBe(false);
  });
});

describe("date input", () => {
  it("parses YYYY-MM-DD as UTC midnight and rejects impossible dates", () => {
    expect(dateInput().parse("2026-02-28").toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(dateInput().safeParse("2026-02-30").success).toBe(false);
    expect(dateInput().safeParse("28/02/2026").success).toBe(false);
  });
  it("can refuse future dates", () => {
    expect(dateInput({ notInFuture: true }).safeParse("2999-01-01").success).toBe(false);
    expect(dateInput({ notInFuture: true }).safeParse("2020-01-01").success).toBe(true);
  });
});

describe("uploaded file type detection (by content, not name)", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  it("recognises allowed types", () => {
    expect(detectFileType(new TextEncoder().encode("%PDF-1.7 ..."))?.mime).toBe("application/pdf");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(detectFileType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))?.ext).toBe("webp");
  });
  it("rejects HTML, SVG, executables and scripts", () => {
    for (const s of ["<html><script>alert(1)</script>", "<svg onload=alert(1)>", "MZ\x90\0", "#!/bin/sh"]) {
      expect(detectFileType(new TextEncoder().encode(s))).toBeNull();
    }
  });
});
