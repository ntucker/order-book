<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

This app manages server state (fetching, caching, mutations and real-time updates) with Reactive Data Client. Use it for all server data, and read the matching `data-client-*` skill before writing, changing or debugging code that loads or changes data. After adding, removing or upgrading `@data-client/*` packages, run `pnpm data-client-skills` and commit the skill links.
