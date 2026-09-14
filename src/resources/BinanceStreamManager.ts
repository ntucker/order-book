import {
  actionTypes,
  type Controller,
  type Manager,
  type Middleware,
} from '@data-client/react';

import { BINANCE_CONNECTION, Connection, type ConnectionStatus } from './Connection';
import { setConnectionStatus } from './connectionStore';
import type { StreamArgs, StreamEndpoint } from './binance';
import { streamHandlers, stopBookSyncs, stopTradeFlush, type StreamHandler } from './streamHandlers';

interface CombinedMessage {
  stream?: string;
  data?: unknown;
  id?: number;
  result?: unknown;
}

const FLUSH_MS = 100;
const SEND_GAP_MS = 250;

function resolveHandler(
  handlers: Record<string, StreamHandler>,
  channel: string,
): StreamHandler | undefined {
  return handlers[channel] ?? handlers[channel.split('_')[0] ?? ''];
}

function parseStream(stream: string): { symbol: string; channel: string } | undefined {
  const at = stream.indexOf('@');
  if (at === -1) return undefined;
  return {
    symbol: stream.slice(0, at).toUpperCase(),
    channel: stream.slice(at + 1),
  };
}

/** Pushes Binance combined-stream updates into the Data Client store. */
export class BinanceStreamManager implements Manager {
  protected websocket?: WebSocket;
  protected handlers: Record<string, StreamHandler>;
  protected url: string;
  protected subscriptions = new Map<string, number>();
  protected attempts = 0;
  protected connectTimer?: ReturnType<typeof setTimeout>;
  protected reconnectTimer?: ReturnType<typeof setTimeout>;
  protected stableTimer?: ReturnType<typeof setTimeout>;
  protected flushTimer?: ReturnType<typeof setTimeout>;
  protected sendLockUntil = 0;
  protected pendingSub = new Set<string>();
  protected pendingUnsub = new Set<string>();
  protected nextId = 1;
  protected connect!: () => void;
  protected closed = false;
  protected controller?: Controller;

  constructor(
    url: string,
    handlers: Record<string, StreamHandler> = streamHandlers,
  ) {
    this.url = url;
    this.handlers = handlers;
  }

  middleware: Middleware = (controller) => {
    this.controller = controller;
    this.connect = () => {
      this.setStatus('connecting');
      const ws = new WebSocket(this.url);
      this.websocket = ws;
      ws.onmessage = (event) => {
        if (this.websocket !== ws || this.closed) return;
        try {
          const msg = JSON.parse(event.data) as CombinedMessage;
          this.handleMessage(controller, msg);
        } catch (e) {
          console.error('Failed to handle message', e);
        }
      };
      ws.onopen = () => {
        if (this.websocket !== ws || this.closed) return;
        this.setStatus('open');
        this.markStable(ws);
        this.resubscribeAll();
        for (const handler of Object.values(this.handlers)) {
          handler.resyncAll?.();
        }
      };
      ws.onclose = () => {
        if (this.websocket !== ws || this.closed) return;
        this.reconnect();
      };
      ws.onerror = () => {
        if (this.websocket !== ws || this.closed) return;
        ws.close();
      };
    };

    return (next) => async (action) => {
      switch (action.type) {
        case actionTypes.SUBSCRIBE:
        case actionTypes.UNSUBSCRIBE: {
          const streams = (action.endpoint as StreamEndpoint).streams?.(
            (action.args[0] ?? {}) as StreamArgs,
          );
          if (!streams?.length) break;
          for (const streamName of streams) {
            if (action.type === actionTypes.SUBSCRIBE) {
              this.subscribe(controller, streamName);
            } else {
              this.unsubscribe(controller, streamName);
            }
          }
          return Promise.resolve();
        }
      }
      return next(action);
    };
  };

  init() {
    this.closed = false;
    this.connectTimer = setTimeout(() => {
      this.connectTimer = undefined;
      if (!this.closed) this.connect();
    }, 0);
  }

  cleanup() {
    this.closed = true;
    this.clearTimers();
    stopTradeFlush();
    stopBookSyncs();
    this.setStatus('closed');
    const ws = this.websocket;
    this.websocket = undefined;
    if (!ws) return;
    ws.onclose = null;
    ws.onerror = null;
    ws.onopen = null;
    ws.onmessage = null;
    ws.close();
  }

  protected setStatus(status: ConnectionStatus) {
    setConnectionStatus(status);
    this.controller?.set(Connection, BINANCE_CONNECTION, {
      id: 'binance',
      status,
      since: Date.now(),
    });
  }

  protected send(data: string) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(data);
    }
  }

  protected subscribe(ctrl: Controller, streamName: string) {
    const count = (this.subscriptions.get(streamName) ?? 0) + 1;
    this.subscriptions.set(streamName, count);
    if (count !== 1) return;
    this.pendingUnsub.delete(streamName);
    this.pendingSub.add(streamName);
    this.scheduleFlush();
    const parsed = parseStream(streamName);
    if (!parsed) return;
    resolveHandler(this.handlers, parsed.channel)?.onSubscribe?.(
      ctrl,
      parsed.symbol,
      parsed.channel,
    );
  }

  protected unsubscribe(ctrl: Controller, streamName: string) {
    const count = (this.subscriptions.get(streamName) ?? 0) - 1;
    if (count > 0) {
      this.subscriptions.set(streamName, count);
      return;
    }
    this.subscriptions.delete(streamName);
    this.pendingSub.delete(streamName);
    this.pendingUnsub.add(streamName);
    this.scheduleFlush();
    const parsed = parseStream(streamName);
    if (!parsed) return;
    resolveHandler(this.handlers, parsed.channel)?.onUnsubscribe?.(
      ctrl,
      parsed.symbol,
      parsed.channel,
    );
  }

  protected scheduleFlush() {
    if (this.flushTimer) return;
    const wait = Math.max(FLUSH_MS, this.sendLockUntil - Date.now());
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flush();
    }, wait);
  }

  protected flush() {
    if (this.websocket?.readyState !== WebSocket.OPEN) return;
    const unsub = [...this.pendingUnsub];
    const sub = [...this.pendingSub];
    this.pendingUnsub.clear();
    this.pendingSub.clear();
    if (unsub.length) {
      this.send(
        JSON.stringify({
          method: 'UNSUBSCRIBE',
          params: unsub,
          id: this.nextId++,
        }),
      );
    }
    if (sub.length) {
      this.send(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params: sub,
          id: this.nextId++,
        }),
      );
    }
    if (unsub.length || sub.length) {
      this.sendLockUntil = Date.now() + SEND_GAP_MS;
    }
  }

  protected resubscribeAll() {
    const streams = [...this.subscriptions.keys()];
    if (!streams.length) return;
    this.send(
      JSON.stringify({
        method: 'SUBSCRIBE',
        params: streams,
        id: this.nextId++,
      }),
    );
  }

  protected handleMessage(ctrl: Controller, msg: CombinedMessage) {
    if ('id' in msg) return;
    if (!msg.stream || !msg.data) return;
    const parsed = parseStream(msg.stream);
    if (!parsed) return;
    const handler = resolveHandler(this.handlers, parsed.channel);
    if (!handler) return;
    try {
      handler.onMessage(ctrl, parsed.symbol, parsed.channel, msg.data);
    } catch (e) {
      console.error('Failed to apply stream update', e);
    }
  }

  protected reconnect() {
    if (this.closed || this.reconnectTimer) return;
    this.setStatus('reconnecting');
    const jitter = Math.floor(Math.random() * 250);
    this.reconnectTimer = setTimeout(
      () => {
        this.reconnectTimer = undefined;
        if (this.closed) return;
        this.attempts += 1;
        this.connect();
      },
      Math.min(10000, (2 ** this.attempts - 1) * 1000) + jitter,
    );
  }

  protected markStable(ws: WebSocket) {
    if (this.stableTimer) clearTimeout(this.stableTimer);
    this.stableTimer = setTimeout(() => {
      this.stableTimer = undefined;
      if (this.websocket === ws && !this.closed) this.attempts = 0;
    }, 2000);
  }

  protected clearTimers() {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.stableTimer) clearTimeout(this.stableTimer);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.connectTimer = undefined;
    this.reconnectTimer = undefined;
    this.stableTimer = undefined;
    this.flushTimer = undefined;
  }
}
