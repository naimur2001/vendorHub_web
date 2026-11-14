// The 64 districts of Bangladesh, by division. These are the exact keys the API stores and
// accepts (a market's `district`). The API never sends a name: the English and Bangla names
// are in messages/*.json under "Districts" and "Divisions", with the same keys.

export const DIVISIONS = [
  { key: "barishal", districts: ["barguna", "barishal", "bhola", "jhalokathi", "patuakhali", "pirojpur"] },
  {
    key: "chattogram",
    districts: ["bandarban", "brahmanbaria", "chandpur", "chattogram", "cumilla", "coxs-bazar", "feni", "khagrachhari", "lakshmipur", "noakhali", "rangamati"],
  },
  {
    key: "dhaka",
    districts: ["dhaka", "faridpur", "gazipur", "gopalganj", "kishoreganj", "madaripur", "manikganj", "munshiganj", "narayanganj", "narsingdi", "rajbari", "shariatpur", "tangail"],
  },
  { key: "khulna", districts: ["bagerhat", "chuadanga", "jashore", "jhenaidah", "khulna", "kushtia", "magura", "meherpur", "narail", "satkhira"] },
  { key: "mymensingh", districts: ["jamalpur", "mymensingh", "netrokona", "sherpur"] },
  { key: "rajshahi", districts: ["bogura", "joypurhat", "naogaon", "natore", "chapainawabganj", "pabna", "rajshahi", "sirajganj"] },
  { key: "rangpur", districts: ["dinajpur", "gaibandha", "kurigram", "lalmonirhat", "nilphamari", "panchagarh", "rangpur", "thakurgaon"] },
  { key: "sylhet", districts: ["habiganj", "moulvibazar", "sunamganj", "sylhet"] },
] as const;

export type Division = (typeof DIVISIONS)[number]["key"];
export type District = (typeof DIVISIONS)[number]["districts"][number];

export const DISTRICTS: readonly District[] = DIVISIONS.flatMap((division) => [...division.districts]);

export const DEFAULT_DISTRICT: District = "dhaka";

/** True for one of the 64 keys. Use it on anything from a URL or the API before trusting it. */
export function isDistrict(value: unknown): value is District {
  return typeof value === "string" && (DISTRICTS as readonly string[]).includes(value);
}
