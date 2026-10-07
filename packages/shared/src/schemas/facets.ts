/**
 * Facettes : les valeurs réellement présentes dans les données de l'utilisateur, avec leur
 * effectif. Elles alimentent les filtres cumulables des onglets de la collection — on ne
 * propose jamais un filtre qui ne renverrait rien.
 */
export interface FacetValueDto {
  value: string;
  count: number;
}

/** Facettes de l'onglet Cartes (calculées sur la collection, pas sur tout le catalogue). */
export interface CollectionFacetsDto {
  categories: FacetValueDto[];
  archetypes: FacetValueDto[];
  attributes: FacetValueDto[];
  races: FacetValueDto[];
  rarities: FacetValueDto[];
  languages: FacetValueDto[];
  conditions: FacetValueDto[];
  /** Extensions d'où viennent les cartes possédées (valeur = id de l'extension). */
  sets: FacetValueDto[];
}
