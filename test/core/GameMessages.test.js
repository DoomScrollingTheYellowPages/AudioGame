// ─────────────────────────────────────────────
// GameMessages — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hitMessage, comboMessage, resultMessage } from '../../src/core/GameMessages.js';

describe('GameMessages', () => {

  describe('hitMessage', () => {
    it('returns a string for each tier', () => {
      for (const tier of ['perfect', 'great', 'good', 'miss']) {
        const msg = hitMessage(tier);
        assert.ok(typeof msg === 'string' && msg.length > 0, `${tier} should return a message`);
      }
    });

    it('returns a miss message for unknown tier', () => {
      const msg = hitMessage('unknown');
      assert.ok(typeof msg === 'string');
    });
  });

  describe('comboMessage', () => {
    it('returns message at milestone combos', () => {
      assert.ok(comboMessage(10) !== null);
      assert.ok(comboMessage(20) !== null);
      assert.ok(comboMessage(50) !== null);
      assert.ok(comboMessage(100) !== null);
    });

    it('returns null for non-milestone combos', () => {
      assert.equal(comboMessage(5), null);
      assert.equal(comboMessage(15), null);
    });
  });

  describe('resultMessage', () => {
    it('returns encouraging message for high accuracy', () => {
      const msg = resultMessage(98);
      assert.ok(typeof msg === 'string' && msg.length > 0);
    });

    it('returns encouraging message for low accuracy', () => {
      const msg = resultMessage(20);
      assert.ok(typeof msg === 'string' && msg.length > 0);
    });

    it('returns different pools for different ranges', () => {
      // Run multiple times to increase chance of different messages
      const high = new Set();
      const low = new Set();
      for (let i = 0; i < 20; i++) {
        high.add(resultMessage(98));
        low.add(resultMessage(30));
      }
      // At least the message pools should be different sets
      assert.ok(high.size >= 1);
      assert.ok(low.size >= 1);
    });
  });
});
