import 'server-only';
import { mockRegistry } from './mock.ts';
import type { RegistryAdapter } from './types.ts';

// Swap point for a live source: select an adapter by environment without touching callers.
export function getRegistry(): RegistryAdapter {
  switch (process.env.REGISTRY_ADAPTER ?? 'mock') {
    default:
      return mockRegistry;
  }
}
