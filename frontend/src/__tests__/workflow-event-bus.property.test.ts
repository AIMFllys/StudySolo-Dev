import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createEventBus,
  eventBus,
  type EventMap,
} from '@/lib/events/event-bus';

describe('workflow event bus', () => {
  afterEach(() => {
    eventBus.clear();
  });

  it('delivers typed workflow payloads and unsubscribes cleanly', () => {
    const bus = createEventBus<EventMap>();
    const toolHandler = vi.fn();
    const unsubscribe = bus.on('canvas:tool-change', toolHandler);

    bus.emit('canvas:tool-change', { tool: 'pan' });
    unsubscribe();
    bus.emit('canvas:tool-change', { tool: 'search' });

    expect(toolHandler).toHaveBeenCalledTimes(1);
    expect(toolHandler).toHaveBeenCalledWith({ tool: 'pan' });
    expect(bus.listenerCount('canvas:tool-change')).toBe(0);
  });

  it('fans out slip toggle events to every workflow listener', () => {
    const first = vi.fn();
    const second = vi.fn();

    eventBus.on('workflow:toggle-all-slips', first);
    eventBus.on('workflow:toggle-all-slips', second);

    eventBus.emit('workflow:toggle-all-slips', { expanded: true });

    expect(first).toHaveBeenCalledWith({ expanded: true });
    expect(second).toHaveBeenCalledWith({ expanded: true });
    expect(eventBus.listenerCount('workflow:toggle-all-slips')).toBe(2);
  });

  it('supports the node-store add-node event without window CustomEvent glue', () => {
    const handler = vi.fn();

    eventBus.on('node-store:add-node', handler);
    eventBus.emit('node-store:add-node', { nodeType: 'summary' });

    expect(handler).toHaveBeenCalledWith({ nodeType: 'summary' });
  });

  it('supports tier refresh broadcasts for sidebar listeners', () => {
    const handler = vi.fn();

    eventBus.on('studysolo:tier-refresh', handler);
    eventBus.emit('studysolo:tier-refresh', undefined);

    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('supports open and close node-config events without changing payload shape', () => {
    const openHandler = vi.fn();
    const closeHandler = vi.fn();

    eventBus.on('workflow:open-node-config', openHandler);
    eventBus.on('workflow:close-node-config', closeHandler);

    eventBus.emit('workflow:open-node-config', {
      nodeId: 'node-1',
      anchorRect: {
        top: 1,
        left: 2,
        right: 3,
        bottom: 4,
        width: 5,
        height: 6,
      },
    });
    eventBus.emit('workflow:close-node-config', undefined);

    expect(openHandler).toHaveBeenCalledWith({
      nodeId: 'node-1',
      anchorRect: {
        top: 1,
        left: 2,
        right: 3,
        bottom: 4,
        width: 5,
        height: 6,
      },
    });
    expect(closeHandler).toHaveBeenCalledWith(undefined);
  });
});
