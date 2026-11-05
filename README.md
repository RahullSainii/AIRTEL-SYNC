# AIRTEL-SYNC

AI-powered, consent-first digital onboarding for Indian SMBs. This baseline implementation keeps LLM use limited to unstructured need extraction and multilingual explanations, while all pricing/compliance outcomes stay deterministic in code.

## Core modules

- `src/lib/engine.ts`: deterministic catalogue + city-tier + dependency pricing logic
- `src/lib/gstin.ts`: GSTIN coercion + checksum validation to avoid false flags
- `src/lib/registry/`: pluggable `RegistryAdapter` contract with human fallback queue

## Scripts

- `pnpm dev` - run Next.js App Router dev server
- `pnpm test` - run unit tests
- `pnpm benchmark` - run deterministic KYC/quote benchmark loop
- `pnpm typecheck` - TypeScript checks
- `pnpm build` - production build
