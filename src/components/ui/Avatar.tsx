export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Initsiaalidega ring, taust = värv 12 % läbipaistvusega (Figma). */
export function Avatar({ name, color, size = 24, dark = false, src }: { name: string; color: string; size?: number; dark?: boolean; src?: string | null }) {
  if (src) return <img src={src} alt="" aria-hidden className="inline-block shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size >= 30 ? 11 : 10,
        background: `${color}1f`,
        color: dark ? "#c4b5fd" : color,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
