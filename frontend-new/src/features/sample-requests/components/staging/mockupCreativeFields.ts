import type { ProductDetailItem } from "@/infrastructure/api/masterApi";

const normalize = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase();

const bindingFields = new Set([
  "BINDINGCOLORSTYLE",
  "EDGEFINISHINGNOOFDESIGN",
  "EDGEFINISHINGNOOFDESIGNS",
  "EDGEFINISHINNOOFDESIGN",
  "EDGEFINISHINGDESIGNNOTES",
  "ACCESSORIESDETAIL",
  "ACCESSORIESDETAILS",
  "ACCESSORIEESDETAIL",
]);

const componentFieldSuffixes = new Set([
  "NAMEOFCOLORSFB1",
  "NAMEOFCOLORFB1",
  "NAMEOFCOLORB1",
  "RULLINGPRINTINGDESIGNNAME1",
  "RULINGPRINTINGDESIGNNAME1",
  "RULINGPRINTDESIGNNAME1",
  "NAMEOFCOLORSFB",
  "NAMEOFCOLORFB",
  "NAMEOFCOLORB",
  "RULLINGPRINTINGDESIGNNAME2",
  "RULINGPRINTINGDESIGNNAME2",
  "RULINGPRINTDESIGNNAME2",
]);

const dividerFields = new Set([
  "NOOFDESIGNPRINT",
  "NOOFDESIGNSPRINT",
  "NOOFCOLORB",
  "NOOFCOLORSFB",
  "NOOFCOLOURSFB",
  "NAMEOFCOLORB",
  "NAMEOFCOLORSFB",
  "PRINTINGFINISH",
  "PRINTFINISHING",
  "D2NAMEOFCOLORB",
  "D2PRINTINGFINISH",
]);

const packagingSpecFields = new Set([
  "NOOFCOLOURSFB",
  "NAMEOFCOLORSFB2",
]);

const packingFields = new Set([
  "NAMEOFCOLOR",
  "NAMEOFCOLORFB",
  "NAMEOFCOLORFB2",
  "DESIGNCOLORASSORTMENT",
  "SPECIALINSTRUCTION",
  "SPECIALINSTRUCTIONS",
  "DESIGNCOLORASSORTMENT2",
]);

export function isMockupCreativeCharacteristic(className: string, characteristicName: string): boolean {
  const classKey = normalize(className);
  const field = normalize(characteristicName);

  if (classKey.startsWith("NBBINDING")) return bindingFields.has(field);
  if (["NBDIVIDERSPEC", "NBDIVIDERSPECS", "NBDIVIDINGSPEC", "NBDIVIDINGSPECS"].includes(classKey)) {
    return dividerFields.has(field) || dividerFields.has(field.replace(/^D[12]/, ""));
  }
  if (classKey.startsWith("PACKAGINGSPEC")) return packagingSpecFields.has(field);
  if (["PACKINGDETAIL", "PACKINGDETAILS", "PACKAGINGDETAIL", "PACKAGINGDETAILS"].includes(classKey)) {
    return packingFields.has(field);
  }

  const componentMatch = classKey.match(/^(?:NB)?COMPONENT([1-6])$/);
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

