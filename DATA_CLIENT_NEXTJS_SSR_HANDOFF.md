# Reactive Data Client: Next.js streamed SSR handoff

## Executive summary

Reactive Data Client's Next.js App Router integration has one confirmed
serialization defect and one related hydration-safety gap:

1. **Confirmed defect — late descendant requests can be omitted from the
   serialized cache.** The server adapter decides that request collection is
   complete after a fixed 10 ms quiet window. An async Server Component between
   a root `DataProvider` and a data-reading Client Component can outlive that
   window. The response then contains server-rendered data HTML but an empty
   `#data-client-data` snapshot.
2. **Hydration-safety gap — browser consumers read the latest store state rather
   than the transferred server snapshot while hydrating.** A manager can
   legitimately update the store after an early Suspense boundary hydrates but
   before a later boundary hydrates. The later boundary can render the live
   state against older server HTML.

These should be fixed independently:

- Make the Next.js server adapter aware of streamed request production instead
  of inferring completion from elapsed time.
- Make cache consumers use React's hydration snapshot contract so updates can
  continue normally while each hydrating boundary sees the transferred server
  snapshot.

Do **not** globally pause managers or queue all controller actions. React does
not expose a reliable global "hydration finished" event, and a dispatch gate
would also delay mutations, resets, fetch completion, and error processing.

## Scope and confidence

### Confirmed in an application

Application:

- Next.js 16.3.4, App Router, Turbopack
- React and React DOM 19.2.8
- `@data-client/react` 0.18.1
- `@data-client/rest` 0.18.1
- Dynamic `[symbol]` route
- Root-level `DataProvider`
- Async Server Component work before rendering Client Components using
  `useLive()`

Observed under mixed concurrent requests:

- All responses contained final server-rendered market rows.
- Some responses serialized the complete route cache, approximately 65–75 KB.
- Other responses serialized exactly the 101-byte empty initial state:

```json
{"entities":{},"endpoints":{},"indexes":{},"meta":{},"entitiesMeta":{},"optimistic":[],"lastReset":0}
```

The failing routes changed with which async route work completed after the
quiet window. Moving `DataProvider` below the awaited Server Component made
eight concurrent mixed-route responses consistently serialize their expected
route-specific cache.

### Confirmed in the upstream source

At upstream commit `b2435c4b7c`, the relevant implementation remains in:

- `packages/react/src/server/nextjs/DataProvider/createPersistedStoreServer.tsx`
- `packages/react/src/server/nextjs/DataProvider/DataProvider.tsx`
- `packages/react/src/server/nextjs/DataProvider/createPersistedStoreClient.tsx`
- `packages/react/src/hooks/useCacheState.ts`
- `packages/react/src/components/DataStore.tsx`
- `packages/react/src/context.ts`

`createPersistedStoreServer.tsx` starts an `initPromise`, checks
`networkManager.allSettled()`, and, if no fetch was seen on the first pass,
waits 10 ms once. Its own TODO says:

```ts
// TODO: instead of waiting 10ms - see if we can wait until next part of react
// is streamed and race with networkManager getting new fetches
await new Promise(resolve => setTimeout(resolve, 10));
```

Once that promise resolves, later requests can update the server store but
cannot change the already-selected serialized snapshot.

In the browser, `useCacheState()` currently falls through to:

```ts
() => use(StateContext)
```

The existing `useSyncExternalStore()` path only runs when
`typeof window === 'undefined'`. Consequently, the browser hydration render has
no separate `getServerSnapshot` value.

### Important non-library finding

The original order-book hydration error was independently reproduced in a
clean browser and traced to application code that rendered 6 rows on the server
and 14 rows on the initial client render based on `window.innerWidth`. That bug
was fixed by using a deterministic initial row count and measuring after mount.

It must not be used as evidence that a Data Client manager caused the original
warning. The manager/hydration case below is a separate library hardening case
with its own reproducible test.

## Defect A: late streamed requests are missing from serialized state

### Why this matters

The SSR guide explicitly recommends putting `DataProvider` in the root layout.
App Router pages and nested Server Components are commonly asynchronous. A
root provider therefore has to tolerate an arbitrary delay before a descendant
Client Component begins rendering and requests data.

When the serialized cache is empty but streamed HTML contains data:

- the browser repeats requests already completed by the server;
- hydration can suspend or replace useful server HTML;
- changing responses can produce hydration mismatches;
- above-the-fold SSR is paid for but its user-experience benefit is lost;
- behavior depends on timing and concurrent route activity.

Changing 10 ms to a larger timeout does not fix the contract. It only changes
which applications reproduce the race.

## Minimal reproduction A

Create a Next.js App Router app using React 19 and
`@data-client/react/nextjs`.

### `app/layout.tsx`

```tsx
import { DataProvider } from '@data-client/react/nextjs';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DataProvider devButton={null}>{children}</DataProvider>
      </body>
    </html>
  );
}
```

### `lib/getValue.ts`

```ts
import { Endpoint } from '@data-client/rest';

export const getValue = new Endpoint(
  async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return { value: 'server payload' };
  },
  { name: 'getValue' },
);
```

### `app/Value.tsx`

```tsx
'use client';

import { useSuspense } from '@data-client/react';

import { getValue } from '../lib/getValue';

export default function Value() {
  const result = useSuspense(getValue);
  return <p data-testid="value">{result.value}</p>;
}
```

### `app/page.tsx`

```tsx
import Value from './Value';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await new Promise(resolve => setTimeout(resolve, 50));
  return <Value />;
}
```

### Verification

Build and run the production app, then save the complete streamed response:

```bash
curl --no-buffer --fail http://localhost:3000/ > response.html
```

The response contains `server payload` in the completed Suspense segment, but
the current implementation can emit:

```html
<script id="data-client-data" type="application/json">
  {"entities":{},"endpoints":{},"indexes":{},"meta":{},"entitiesMeta":{},"optimistic":[],"lastReset":0}
</script>
```

Increasing the page delay makes the failure deterministic. Reducing it below
the quiet window or moving `DataProvider` into `page.tsx` after the delay hides
the defect.

### Expected behavior

If server-rendered Data Client consumers resolve successfully, the transferred
state needed to render those consumers must be available before the browser
hydrates them. The provider's documented root-layout placement must not make
correctness depend on descendant timing.

## Recommended fix A

### Required invariant

The server adapter must not declare the cache final merely because no request
was observed during a short interval. It needs a render-aware completion or
incremental-transfer protocol.

### Preferred direction: incremental streamed snapshots

For App Router streaming, integrate with Next.js's server insertion lifecycle,
using `useServerInsertedHTML()` or an equivalent supported mechanism:

1. Keep a request-scoped Data Client store.
2. Track a monotonically increasing store revision.
3. When a streamed segment resolves after changing the store, insert a
   serialized snapshot or delta before content that depends on that revision.
4. Bootstrap the browser store from the first payload.
5. Apply later payloads in order before their associated boundaries hydrate.
6. Deduplicate payloads by request-local revision.

This resembles established streamed-hydration integrations: the transfer
follows Suspense progress rather than trying to predict when all descendants
will begin fetching.

Security and correctness requirements:

- Preserve the existing CSP nonce support.
- Use safe JSON escaping for inline script content.
- Never share stores or revision counters across requests.
- Preserve reducer order and entity metadata.
- Define reset behavior explicitly; a reset must supersede earlier revisions.
- Avoid inserting duplicate full snapshots when no state changed.

### Smaller fallback: explicit finalization boundary

If incremental transfer is too large for the first patch, expose an explicit
server finalization boundary that can be placed after asynchronous Server
Component work and update the docs accordingly.

This is less ergonomic and would make the current "provider in root layout"
guidance conditional. It is still safer than silently relying on 10 ms.

### Approaches to reject

- Increasing the 10 ms timeout.
- Waiting for `NetworkManager.allSettled()` once; it only knows requests that
  have already started.
- Assuming JSX sibling order proves descendants cannot start later.
- Resolving an empty snapshot and expecting later store mutations to alter the
  already-resolved value.

## Gap B: live updates during selective hydration

### Motivation

React can hydrate Suspense boundaries at different times. A provider or an
early boundary may commit effects while another server-rendered boundary
remains dehydrated. Subscription, polling, SSE, or WebSocket updates can then
advance the client store.

The desired behavior is:

- managers continue receiving and reducing updates immediately;
- already hydrated consumers receive live updates;
- each still-hydrating consumer renders the exact transferred server snapshot;
- after that consumer hydrates, it converges to the latest live state without
  losing or replaying actions.

This is visibility deferral, not action deferral.

## Minimal reproduction B

Use a test manager to advance one entity after the provider and an eager
consumer hydrate. Keep a second consumer dehydrated behind a controlled
Suspense boundary until after that update.

### `lib/version.ts`

```ts
import { Endpoint, Entity } from '@data-client/rest';

export class Version extends Entity {
  id = '';
  revision = 0;

  pk() {
    return this.id;
  }

  static key = 'Version';
}

export const getVersion = new Endpoint(
  async () => ({ id: 'current', revision: 1 }),
  {
    name: 'getVersion',
    schema: Version,
  },
);
```

### `app/getManagers.ts`

```tsx
'use client';

import {
  getDefaultManagers,
  type Controller,
  type Manager,
  type Middleware,
} from '@data-client/react';

import { Version } from '../lib/version';

class PushManager implements Manager {
  private controller?: Controller;
  private timer?: ReturnType<typeof setTimeout>;

  middleware: Middleware = controller => {
    this.controller = controller;
    return next => action => next(action);
  };

  init() {
    this.timer = setTimeout(() => {
      void this.controller?.set(Version, { id: 'current' }, {
        id: 'current',
        revision: 2,
      });
    }, 0);
  }

  cleanup() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}

export default function getManagers() {
  return [...getDefaultManagers(), new PushManager()];
}
```

### `app/Provider.tsx`

```tsx
'use client';

import { DataProvider } from '@data-client/react/nextjs';
import { useMemo, type ReactNode } from 'react';

import getManagers from './getManagers';

export default function Provider({ children }: { children: ReactNode }) {
  const managers = useMemo(() => getManagers(), []);
  return (
    <DataProvider managers={managers} devButton={null}>
      {children}
    </DataProvider>
  );
}
```

### `app/HydrationDemo.tsx`

```tsx
'use client';

import { useLive } from '@data-client/react';
import { Suspense, use, useEffect, type ReactNode } from 'react';

import { getVersion } from '../lib/version';

let releaseGate = () => {};
const clientGate =
  typeof window === 'undefined'
    ? undefined
    : new Promise<void>(resolve => {
        releaseGate = resolve;
      });

function Gate({ children }: { children: ReactNode }) {
  if (clientGate) use(clientGate);
  return children;
}

function Value({ testId }: { testId: string }) {
  const version = useLive(getVersion);
  return <p data-testid={testId}>revision {version.revision}</p>;
}

function EagerValue() {
  useEffect(() => {
    const timer = setTimeout(releaseGate, 50);
    return () => clearTimeout(timer);
  }, []);
  return <Value testId="eager" />;
}

export default function HydrationDemo() {
  return (
    <>
      <EagerValue />
      <Suspense fallback={null}>
        <Gate>
          <Value testId="delayed" />
        </Gate>
      </Suspense>
    </>
  );
}
```

### `app/layout.tsx`

```tsx
import Provider from './Provider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
```

### `app/page.tsx`

```tsx
import HydrationDemo from './HydrationDemo';

export default function Page() {
  return <HydrationDemo />;
}
```

The environment branch in `Gate` is deliberate test instrumentation. It does
not render different eventual markup; Suspense retains the server HTML until
the gate is released. `PushManager` changes the live cache to revision 2 before
the delayed boundary resumes.

Capture hydration failures with `hydrateRoot(..., { onRecoverableError })`.
Under the current browser `useCacheState()` implementation, the delayed
consumer can read the latest `StateContext` value while hydrating against
revision-1 HTML.

### Expected behavior

`onRecoverableError` is not called. The delayed boundary hydrates with revision
1 and then synchronously catches up to the current revision.

## Recommended fix B

Use React's `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`
contract at the cache-read layer.

React documents that `getServerSnapshot` is used both during server rendering
and during hydration of server-rendered content. This is the exact ownership
boundary needed here.

### Minimal integration shape

Preserve an immutable reference to the transferred `initialState` for the
lifetime of the provider:

```ts
const liveState = use(StateContext);
const hydrationState = use(HydrationStateContext);

return React.useSyncExternalStore(
  emptySubscribe,
  () => liveState,
  () => hydrationState,
);
```

`StateContext` can continue driving normal client re-renders, so the first
implementation need not replace `useEnhancedReducer` with a new external-store
implementation. `HydrationStateContext` is internal and is provided by
`DataStore` from its stable `initialState` prop.

Treat this as the smallest candidate implementation, not as proven solely by
inspection. The selective-hydration regression test above must pass. If live
`StateContext` propagation wakes or replaces a dehydrated boundary before
`getServerSnapshot` can protect its render, expose the reducer through a real
stable external-store interface and have `useCacheState()` subscribe to that
store directly. The ownership and public API remain the same either way.

Compatibility requirements:

- Use this path only when `React.useSyncExternalStore` exists.
- Preserve the current context path for React 16 and 17.
- Keep `subscribe` referentially stable.
- Return the same immutable hydration snapshot object throughout hydration.
- Ensure every public cache-reading hook reaches `useCacheState()`.

A future refactor may expose the reducer as a real external store, but that
larger change is not required to prove the hydration contract.

### Why not queue manager actions?

A provider-level dispatch queue cannot reliably identify which actions are
"live transport updates." It would also affect:

- fetch resolution;
- user mutations;
- optimistic updates;
- resets;
- invalidation;
- errors;
- custom controller calls.

Manager-local queues know provenance but duplicate hydration policy across
polling, WebSocket, SSE, and application managers. They also need ordering,
coalescing, reset, overflow, and teardown rules.

React exposes no official global hydration-complete signal. A provider
`useEffect`, `setTimeout`, animation frame, or deferred manager `init()` is
therefore a mitigation, not a correctness boundary.

With `getServerSnapshot`, actions remain ordered in the normal reducer. No
updates are lost or replayed; only unhydrated consumers temporarily observe the
transferred snapshot.

## Related code-path issue: server managers prop

`createPersistedStoreServer(managers?)` accepts managers, but the Next.js
`DataProvider` currently calls it as:

```ts
useMemo(createPersistedStore, [])
```

The `managers` prop is later read only to calculate `hasDevManager`; it is not
used to construct the server store.

This means the public Next.js provider accepts custom managers that the server
silently ignores. Confirm whether this is intentional. If not, add a regression
test and pass server-compatible managers into server store creation. Browser-
only managers remain responsible for being excluded or inert on the server.

This issue is not required to reproduce defect A, because the default
`NetworkManager` is sufficient.

## Test plan

### Server serialization tests

Add a Node test near the Next.js adapter, for example:

`packages/react/src/server/nextjs/DataProvider/__tests__/streaming.node.tsx`

Cover:

1. A descendant starts its first fetch after more than 10 ms.
2. Multiple descendants begin requests in separate streamed passes.
3. The transferred payload contains every endpoint required by emitted data
   HTML.
4. Concurrent stores with different endpoint keys never share state.
5. A failed request settles without preventing finalization.
6. No-request pages serialize the initial state without an arbitrary delay.
7. A custom server-compatible `NetworkManager` passed through `managers` is
   actually used, if that prop is intended to work server-side.

Because the defect depends on App Router streaming, also add a production-mode
integration fixture. The existing `examples/nextjs` app is suitable for a
manual/docs example, but a small dedicated fixture with an automated HTTP
assertion will be less fragile.

The integration assertion should inspect the complete response body, not only
the hydrated DOM:

- data text is present in the streamed HTML;
- `#data-client-data` contains the corresponding endpoint result;
- simultaneous requests for distinct route params receive distinct snapshots.

### Browser hydration tests

Add a jsdom/ReactDOM test, for example:

`packages/react/src/components/__tests__/provider-hydration.web.tsx`

Cover:

1. Server render two consumers from one immutable initial state.
2. Hydrate one boundary while a second boundary remains suspended.
3. Dispatch several ordered updates.
4. Release the delayed boundary.
5. Assert no `onRecoverableError`.
6. Assert the eager consumer updates live.
7. Assert the delayed consumer first hydrates consistently and then reaches
   the latest revision.
8. Repeat with `StrictMode`.
9. Dispatch a reset during the gate and verify the delayed consumer hydrates
   from the original server snapshot before observing reset state.
10. Verify React 16/17 continue using the legacy context implementation.

Do not assert only final DOM text. A hydration mismatch may recover to the
correct final text while discarding server HTML.

## Documentation changes

Update `docs/core/guides/ssr.md` and the Next.js example.

Suggested replacement/addition:

> `DataProvider` may be placed in the root layout. Reactive Data Client tracks
> data discovered by streamed Client Components and transfers the matching
> cache state before those boundaries hydrate. Async Server Components may
> appear between the provider and data consumers; no timing delay or manual
> prefetch is required.
>
> During hydration, subscriptions may continue updating the client store.
> Components still hydrating read the transferred server snapshot and
> automatically catch up to the latest state after hydration.

Add an async Server Component to `examples/nextjs` so the documented root
layout arrangement continuously exercises the late-descendant case.

If fix A initially ships with an explicit boundary rather than incremental
transfer, document that limitation plainly and change the root-layout example
to the supported placement.

## Changeset/changelog text

Add a changeset rather than editing generated changelogs directly:

```md
---
'@data-client/react': patch
---

Fix Next.js App Router streamed SSR when data requests begin after asynchronous
Server Components, ensuring emitted HTML and serialized cache state stay
consistent. Hydrating consumers now retain the transferred server snapshot
while subscription updates continue, then catch up to the latest client state
after hydration.
```

If the server-manager prop is fixed separately, give it a separate changeset:

```md
---
'@data-client/react': patch
---

Honor server-compatible custom managers passed to the Next.js DataProvider
during server rendering.
```

## Acceptance criteria

The fix is complete when:

- no fixed-duration quiet window determines whether future descendant requests
  exist;
- the root-layout example works with an async Server Component delayed well
  beyond 10 ms;
- complete streamed HTML and transferred cache agree;
- concurrent parameterized routes have request-isolated snapshots;
- live updates can occur between boundary hydrations without a recoverable
  hydration error;
- hydrated consumers converge to the latest state without refetching completed
  SSR requests;
- manager action ordering and cleanup semantics are unchanged;
- React 16/17 compatibility remains intact;
- React 18/19 SSR and hydration tests pass;
- CSP nonce and safe serialization behavior remain covered.

## Downstream order-book migration after release

Once an upstream release contains fix A:

1. Upgrade `@data-client/react` and `@data-client/rest` together.
2. Move the order-book `Provider` back to the root layout and remove the
   route-local wrapper from `app/[symbol]/page.tsx`. This restores one provider
   across symbol navigations and follows the upstream documentation.
3. Keep manager construction inside `useMemo()` so each mounted provider owns
   one stable manager set.
4. Keep the deterministic initial order-book row count. That was an independent
   application hydration bug.
5. Keep the WebSocket manager's cancellable deferred connection unless the
   upstream manager lifecycle explicitly prevents Strict Mode's throwaway
   effect from opening a socket. It solves transport lifecycle noise, not cache
   hydration.
6. Re-run production verification:
   - inspect raw HTML for ticker, book, and trade rows;
   - inspect `#data-client-data` for the matching symbol;
   - issue concurrent requests for several symbols;
   - load in a clean browser and assert no hydration errors or duplicate
     initial requests.

If the upstream release contains only fix B, keep the route-local provider
until fix A ships. Hydration snapshots cannot recover data that the server
failed to serialize.

## Remaining downstream work unrelated to the upstream patch

`LocalBookSync` currently performs its depth snapshot with direct `fetch()` and
manually calls `OrderBook.process()` before `controller.set()`. Review this
separately against Data Client endpoint conventions and Binance's required
"subscribe, buffer, snapshot, replay" order. It is not the cause of defect A,
and it should not be folded into the upstream SSR patch.

