import { pinyin } from "pinyin-pro";

export function nameToPinyinAccountPart(name: string) {
  return pinyin(name, {
    toneType: "none",
    type: "array",
  })
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}