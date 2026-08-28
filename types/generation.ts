import type { Ad } from "@/types";

export type GenerationListItem = Ad & {
  productImageUrl: string;
  finalUrl: string | null;
};
