/**
 * WCAG 2.1 relative luminance → readable text color over a solid hex background.
 * Returns "#fff" or "#111111" whichever meets ≥ 4.5:1 contrast ratio.
 * Falls back to "#fff" when hex cannot be parsed.
 */
export function readableTextOn(hex: string): "#fff" | "#111111" {
  const luminance = relativeLuminance(hex);
  if (luminance === null) return "#fff";
  // contrast ratio with white: (1 + 0.05) / (luminance + 0.05)
  // contrast ratio with #111 (luminance ≈ 0.0177): (luminance + 0.05) / (0.0177 + 0.05)
  const contrastWhite = (1.05) / (luminance + 0.05);
  const contrastDark  = (luminance + 0.05) / (0.0177 + 0.05);
  return contrastWhite >= contrastDark ? "#fff" : "#111111";
}

function relativeLuminance(hex: string): number | null {
  const clean = hex.replace(/^#/, "");
  const full = clean.length === 3
    ? clean.split("").map(c => c + c).join("")
    : clean.length >= 6 ? clean.slice(0, 6) : null;
  if (!full) return null;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
