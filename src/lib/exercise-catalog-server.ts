import "server-only";
import catalog from "@/data/exercises/catalog.json";
import type {Exercise} from "./exercise-catalog";
export const exercises=catalog as Exercise[];
export const exerciseFacets={bodyParts:[...new Set(exercises.map(row=>row.bodyPart))].sort(),equipment:[...new Set(exercises.map(row=>row.equipment))].sort(),targets:[...new Set(exercises.map(row=>row.target))].sort()};
