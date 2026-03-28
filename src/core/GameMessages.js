// ─────────────────────────────────────────────
// GameMessages — playful, gamified feedback text
// for score events, combos, and results
// ─────────────────────────────────────────────

const HIT_MESSAGES = {
  perfect: ['Nailed it!', 'Flawless!', 'Perfection!', 'Bullseye!', 'Spot on!'],
  great:   ['Nice one!', 'Sweet!', 'Smooth!', 'Solid!', 'Almost perfect!'],
  good:    ['Not bad!', 'Close enough!', 'Getting there!', 'Decent!'],
  miss:    ['Oops!', 'Shake it off!', 'Try again!', 'Keep going!', 'No worries!'],
};

const COMBO_MILESTONES = {
  10:  'On fire!',
  20:  'Unstoppable!',
  30:  'Legendary streak!',
  50:  'Are you even human?!',
  100: 'GODLIKE!!!',
};

const RESULT_MESSAGES = {
  perfect: ['Beast mode! Absolutely flawless!', 'You crushed it! 100% perfection!'],
  great:   ['Awesome performance!', 'You rock! Almost perfect!'],
  good:    ['Nice effort! Keep practicing!', 'Solid run! Room to grow!'],
  poor:    ['Tough one! Try it slower?', "Don't give up! Practice makes perfect!"],
};

/**
 * Get a random hit feedback message.
 * @param {'perfect'|'great'|'good'|'miss'} tier
 * @returns {string}
 */
export function hitMessage(tier) {
  const pool = HIT_MESSAGES[tier] || HIT_MESSAGES.miss;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get a combo milestone message, or null if not a milestone.
 * @param {number} combo
 * @returns {string|null}
 */
export function comboMessage(combo) {
  return COMBO_MILESTONES[combo] || null;
}

/**
 * Get a results screen message based on accuracy percentage.
 * @param {number} accuracy — 0 to 100
 * @returns {string}
 */
export function resultMessage(accuracy) {
  let pool;
  if (accuracy >= 95) pool = RESULT_MESSAGES.perfect;
  else if (accuracy >= 80) pool = RESULT_MESSAGES.great;
  else if (accuracy >= 50) pool = RESULT_MESSAGES.good;
  else pool = RESULT_MESSAGES.poor;
  return pool[Math.floor(Math.random() * pool.length)];
}
