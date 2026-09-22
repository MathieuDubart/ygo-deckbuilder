import type { OcgCardData } from 'ocgcore-wasm';

/** Ligne de la table `datas` d'une base .cdb (EDOPro), lue avec des entiers 64 bits. */
export interface CdbDataRow {
  id: bigint;
  alias: bigint;
  setcode: bigint;
  type: bigint;
  atk: bigint;
  def: bigint;
  level: bigint;
  race: bigint;
  attribute: bigint;
}

export interface CdbTextRow {
  id: bigint;
  name: string;
  desc: string;
  [key: `str${number}`]: string;
}

const TYPE_LINK = 0x4000000;

/**
 * Convertit une ligne `datas` au format attendu par le moteur :
 * - setcode : jusqu'à 4 archétypes de 16 bits empilés dans un entier 64 bits ;
 * - level : Niveau/Rang/Lien sur l'octet de poids faible, Échelles Pendule sur les octets 2 et 3 ;
 * - Monstres Lien : `def` contient les Flèches Lien.
 */
export function toCardData(row: CdbDataRow): OcgCardData {
  const setcodes: number[] = [];
  for (let sc = row.setcode; sc > 0n; sc >>= 16n) {
    const code = Number(sc & 0xffffn);
    if (code) setcodes.push(code);
  }
  const type = Number(row.type);
  const level = Number(row.level);
  const isLink = (type & TYPE_LINK) !== 0;
  return {
    code: Number(row.id),
    alias: Number(row.alias),
    setcodes,
    type,
    level: level & 0xff,
    attribute: Number(row.attribute),
    race: row.race,
    attack: Number(row.atk),
    defense: isLink ? 0 : Number(row.def),
    lscale: (level >>> 24) & 0xff,
    rscale: (level >>> 16) & 0xff,
    link_marker: isLink ? Number(row.def) : 0,
  };
}

/** Textes des effets (str1…str16) : décrits par `code << 20 | index`. */
export function cardStrings(row: CdbTextRow): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 16; i++) out.push(row[`str${i}`] ?? '');
  return out;
}

/** Fichier strings.conf d'EDOPro : `!system 1150 Activate`, `!victory 0x1 …`, `!setname 0x1 …`. */
export function parseStringsConf(content: string): {
  system: Map<number, string>;
  victory: Map<number, string>;
} {
  const system = new Map<number, string>();
  const victory = new Map<number, string>();
  for (const line of content.split(/\r?\n/)) {
    const m = /^!(system|victory)\s+(0x[0-9a-f]+|\d+)\s+(.+)$/i.exec(line.trim());
    if (!m) continue;
    const id = Number(m[2]);
    (m[1] === 'system' ? system : victory).set(id, m[3]!.trim());
  }
  return { system, victory };
}
