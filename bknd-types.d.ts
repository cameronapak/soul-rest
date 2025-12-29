import type { DB } from "bknd";
import type { Insertable, Selectable, Updateable, Generated } from "kysely";

declare global {
  type BkndEntity<T extends keyof DB> = Selectable<DB[T]>;
  type BkndEntityCreate<T extends keyof DB> = Insertable<DB[T]>;
  type BkndEntityUpdate<T extends keyof DB> = Updateable<DB[T]>;
}

export interface PendingPartners {
  id: Generated<string>;
  name?: string;
  contactName?: string;
  contactEmail?: string;
  website?: string;
  whyWantListed?: string;
  whyPartner?: string;
  adminNotes?: string;
  status?: "pending" | "rejected" | "approved";
  logo?: DB["media"];
}

export interface Partners {
  id: Generated<string>;
  name?: string;
  contactName?: string;
  contactEmail?: string;
  website?: string;
  approvedAt?: Date | string;
  meditations?: Meditations[];
  logo?: DB["media"];
}

export interface Meditations {
  id: Generated<string>;
  title?: string;
  description?: string;
  duration?: number;
  listens?: number;
  published?: boolean;
  youtubeUrl?: string;
  partners_id?: string;
  partners?: Partners;
  content?: DB["media"];
  thumbnail?: DB["media"];
}

interface Database {
  pendingPartners: PendingPartners;
  partners: Partners;
  meditations: Meditations;
}

declare module "bknd" {
  interface DB extends Database {}
}