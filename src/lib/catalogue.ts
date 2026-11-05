import { PRODUCTS } from '../data/generated/products.ts';
import type { Product } from './types.ts';

export { PRODUCTS };
export const PRODUCT_BY_ID: Record<string, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
export const product = (id: string): Product => {
  const p = PRODUCT_BY_ID[id];
  if (!p) throw new Error(`Unknown product ${id}`);
  return p;
};
export const BASE_LINKS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'];
