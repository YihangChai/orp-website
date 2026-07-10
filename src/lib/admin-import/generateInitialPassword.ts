export function generateInitialPassword(role: "teacher" | "student") {
  const prefix = role === "teacher" ? "ORP-T" : "ORP-S";

  const randomPart = crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();

  return `${prefix}-${randomPart}`;
}