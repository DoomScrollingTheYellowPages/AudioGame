// ─────────────────────────────────────────────
// EventBus.test.js — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../src/core/EventBus.js';

describe('EventBus', () => {

  describe('on / emit', () => {
    it('delivers emitted data to subscriber', () => {
      const bus = new EventBus();
      let received = null;
      bus.on('test', d => { received = d; });
      bus.emit('test', { value: 42 });
      assert.deepEqual(received, { value: 42 });
    });

    it('delivers to multiple subscribers for the same event', () => {
      const bus = new EventBus();
      const calls = [];
      bus.on('ping', () => calls.push('a'));
      bus.on('ping', () => calls.push('b'));
      bus.emit('ping', null);
      assert.deepEqual(calls, ['a', 'b']);
    });

    it('does not deliver to subscribers of a different event', () => {
      const bus = new EventBus();
      let called = false;
      bus.on('foo', () => { called = true; });
      bus.emit('bar', null);
      assert.equal(called, false);
    });

    it('emit with no subscribers does not throw', () => {
      const bus = new EventBus();
      assert.doesNotThrow(() => bus.emit('nonexistent', {}));
    });

    it('passes undefined data when emit called without second argument', () => {
      const bus = new EventBus();
      let received = 'not-set';
      bus.on('evt', d => { received = d; });
      bus.emit('evt');
      assert.equal(received, undefined);
    });
  });

  describe('off', () => {
    it('unsubscribes a specific handler', () => {
      const bus = new EventBus();
      let count = 0;
      const fn = () => count++;
      bus.on('x', fn);
      bus.emit('x', null);
      bus.off('x', fn);
      bus.emit('x', null);
      assert.equal(count, 1);
    });

    it('unsubscribing from nonexistent event does not throw', () => {
      const bus = new EventBus();
      assert.doesNotThrow(() => bus.off('ghost', () => {}));
    });

    it('unsubscribing one handler leaves others intact', () => {
      const bus = new EventBus();
      const calls = [];
      const fn1 = () => calls.push(1);
      const fn2 = () => calls.push(2);
      bus.on('y', fn1);
      bus.on('y', fn2);
      bus.off('y', fn1);
      bus.emit('y', null);
      assert.deepEqual(calls, [2]);
    });
  });

  describe('on() unsubscribe handle', () => {
    it('returned function unsubscribes the handler', () => {
      const bus = new EventBus();
      let count = 0;
      const unsub = bus.on('z', () => count++);
      bus.emit('z', null);
      unsub();
      bus.emit('z', null);
      assert.equal(count, 1);
    });
  });

  describe('clear', () => {
    it('removes all listeners', () => {
      const bus = new EventBus();
      let called = false;
      bus.on('a', () => { called = true; });
      bus.on('b', () => { called = true; });
      bus.clear();
      bus.emit('a', null);
      bus.emit('b', null);
      assert.equal(called, false);
    });

    it('new subscriptions work after clear', () => {
      const bus = new EventBus();
      bus.on('x', () => {});
      bus.clear();
      let called = false;
      bus.on('x', () => { called = true; });
      bus.emit('x', null);
      assert.equal(called, true);
    });
  });

  describe('error isolation', () => {
    it('a throwing handler does not prevent other handlers from running', () => {
      const bus = new EventBus();
      const calls = [];
      bus.on('evt', () => { throw new Error('boom'); });
      bus.on('evt', () => calls.push('ran'));
      assert.doesNotThrow(() => bus.emit('evt', null));
      assert.deepEqual(calls, ['ran']);
    });
  });

  describe('same handler registered twice', () => {
    it('Set deduplication: same function only fires once', () => {
      const bus = new EventBus();
      let count = 0;
      const fn = () => count++;
      bus.on('dup', fn);
      bus.on('dup', fn); // same reference
      bus.emit('dup', null);
      assert.equal(count, 1); // Set deduplicates
    });
  });
});
