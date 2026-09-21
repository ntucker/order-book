import {
  actionTypes,
  type Controller,
  type Manager,
  type Middleware,
} from '@data-client/react';

import { OrderBook, streamHandlers } from '@/resources';
import type { Level } from '@/resources';

import type { ClientScenarioCommand } from '../shared/types';
import type { ScenarioRuntime } from './ScenarioRuntime';

type StreamCommand = Extract<ClientScenarioCommand, { kind: 'stream' }>;
type StreamEndpoint = {
  streams?: (args: Record<string, unknown>) => string[];
};

function parseStream(stream: string) {
  const at = stream.indexOf('@');
  if (at < 0) return;
  return {
    symbol: stream.slice(0, at).toUpperCase(),
    channel: stream.slice(at + 1),
  };
}

export function updateLevels(
  previous: Level[],
  changes: unknown,
  side: 'bid' | 'ask',
): Level[] {
  const levels = new Map(previous.map((level) => [level[0], level[1]]));
  if (Array.isArray(changes)) {
    for (const raw of changes) {
      if (!Array.isArray(raw) || raw.length < 2) continue;
      const price = Number(raw[0]);
      const qty = Number(raw[1]);
      if (!Number.isFinite(price) || !Number.isFinite(qty)) continue;
      if (qty === 0) levels.delete(price);
      else levels.set(price, qty);
    }
  }
  return [...levels.entries()].sort((left, right) =>
    side === 'bid' ? right[0] - left[0] : left[0] - right[0],
  );
}

export class ScenarioStreamManager implements Manager {
  private controller?: Controller;
  private unsubscribeRuntime?: () => void;
  private subscriptions = new Map<string, number>();
  private pending: StreamCommand[] = [];

  constructor(private runtime: ScenarioRuntime) {}

  middleware: Middleware = (controller) => {
    this.controller = controller;
    return (next) => async (action) => {
      if (
        action.type !== actionTypes.SUBSCRIBE &&
        action.type !== actionTypes.UNSUBSCRIBE
      ) {
        return next(action);
      }
      const endpoint = action.endpoint as StreamEndpoint;
      const streams =
        endpoint.streams?.(
          (action.args[0] ?? {}) as Record<string, unknown>,
        ) ?? [];
      for (const stream of streams) {
        const count = this.subscriptions.get(stream) ?? 0;
        if (action.type === actionTypes.SUBSCRIBE) {
          this.subscriptions.set(stream, count + 1);
        } else if (count <= 1) {
          this.subscriptions.delete(stream);
        } else {
          this.subscriptions.set(stream, count - 1);
        }
      }
      this.flushPending();
      return Promise.resolve();
    };
  };

  init() {
    this.unsubscribeRuntime = this.runtime.subscribeStreams((command) => {
      if (this.subscriptions.has(command.event.stream)) {
        this.apply(command);
      } else {
        this.pending.push(command);
      }
    });
  }

  cleanup() {
    this.unsubscribeRuntime?.();
    this.unsubscribeRuntime = undefined;
    // DataProvider re-runs init() on Strict Mode remount but does not
    // re-apply middleware. Nilling the controller or subscriptions here
    // drops later scripted ticks.
  }

  private flushPending() {
    const next: StreamCommand[] = [];
    for (const command of this.pending) {
      if (this.subscriptions.has(command.event.stream)) this.apply(command);
      else next.push(command);
    }
    this.pending = next;
  }

  private apply(command: StreamCommand) {
    const controller = this.controller;
    const parsed = parseStream(command.event.stream);
    if (!controller || !parsed) return;
    if (parsed.channel.startsWith('depth')) {
      const data = command.event.data as {
        u?: number;
        lastUpdateId?: number;
        b?: unknown;
        a?: unknown;
      };
      const lastUpdateId = Number(data.u ?? data.lastUpdateId);
      controller.set(OrderBook, { symbol: parsed.symbol }, (previous) => ({
        symbol: parsed.symbol,
        lastUpdateId,
        bids: updateLevels(previous.bids, data.b, 'bid'),
        asks: updateLevels(previous.asks, data.a, 'ask'),
      }));
    } else {
      const handler =
        streamHandlers[parsed.channel] ??
        streamHandlers[parsed.channel.split('_')[0] ?? ''];
      if (!handler) throw new Error(`Unknown scripted stream ${parsed.channel}`);
      handler.onMessage(
        controller,
        parsed.symbol,
        parsed.channel,
        command.event.data,
      );
    }
    this.runtime.recordClientEvent({
      kind: 'command',
      source: command.event.stream,
      summary: `Applied scripted event ${command.eventId}`,
      occurrenceIds: command.event.occurrenceIds,
    });
  }
}
