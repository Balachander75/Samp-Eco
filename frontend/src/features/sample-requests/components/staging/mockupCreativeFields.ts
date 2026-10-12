import type { ProductDetailItem } from "@/infrastructure/api/masterApi";

const normalize = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase();

const bindingFields = new Set([
  "BINDINGCOLORSTYLE",
  "EDGEFINISHINGNOOFDESIGN",
  "EDGEFINISHINNOOFDESIGN",
  "EDGEFINISHINGDESIGNNOTES",
  "ACCESSORIESDETAIL",
  "ACCESSORIEESDETAIL",
]);

const componentFieldSuffixes = new Set([
  "NAMEOFCOLORSFB1",
  "NAMEOFCOLORFB1",
  "NAMEOFCOLORB1",
  "RULLINGPRINTINGDESIGNNAME1",
  "RULINGPRINTINGDESIGNNAME1",
  "NAMEOFCOLORSFB",
  "NAMEOFCOLORFB",
  "NAMEOFCOLORB",
  "RULLINGPRINTINGDESIGNNAME2",
  "RULINGPRINTINGDESIGNNAME2",
]);

const dividerFields = new Set([
  "NOOFDESIGNPRINT",
  "NOOFCOLORB",
  "NAMEOFCOLORB",
  "PRINTINGFINISH",
  "D2NAMEOFCOLORB",
  "D2PRINTINGFINISH",
]);

const packingFields = new Set([
  "NAMEOFCOLOR",
  "NAMEOFCOLORFB",
  "NAMEOFCOLORFB2",
  "DESIGNCOLORASSORTMENT",
  "SPECIALINSTRUCTION",
  "DESIGNCOLORASSORTMENT2",
]);

export function isMockupCreativeCharacteristic(className: string, characteristicName: string): boolean {
  const classKey = normalize(className);
  const field = normalize(characteristicName);

  if (classKey === "NBBINDING") return bindingFields.has(field);
  if (classKey === "NBDIVIDERSPECS") return dividerFields.has(field);
  if (classKey === "PACKINGDETAILS") return packingFields.has(field);

  const componentMatch = classKey.match(/^NBCOMPONENT([1-6])$/);
  if (!componentMatch) return false;
  const index = componentMatch[1];
  const fieldWithoutIndex = field.replace(new RegExp(`^C?${index}`), "");
  return componentFieldSuffixes.has(fieldWithoutIndex);
}

export function creativeCharacteristicKey(className: string, characteristicName: string): string {
  return `${normalize(className)}::${normalize(characteristicName)}`;
}

export function isListedCreativeCharacteristic(
  detail: Pick<ProductDetailItem, "className" | "characteristicName">,
  keys?: Array<{ className: string; characteristicName: string }>
): boolean {
  if (!keys?.length) return false;
  const key = creativeCharacteristicKey(detail.className, detail.characteristicName);
  return keys.some((item) => creativeCharacteristicKey(item.className, item.characteristicName) === key);
}

