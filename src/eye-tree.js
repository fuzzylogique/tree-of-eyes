'use strict';

/*
 * Tree of Eyes
 *
 * A self-balancing binary search tree (AVL) in which every node is an eye.
 *
 *   node        -> Eye
 *   children    -> pupils (every eye has at most two)
 *   insert      -> open
 *   delete      -> close
 *   contains    -> see
 *   height      -> depth perception
 *   rotation    -> eye roll
 *   pre-order   -> foresight
 *   in-order    -> insight
 *   post-order  -> hindsight
 *   level-order -> eye level
 *   iterator    -> eye-terator
 */

class Eye {
  constructor(key) {
    this.key = key;
    this.left = null;
    this.right = null;
    this.height = 1;
  }

  /** The eyes directly beneath this one. */
  get pupils() {
    return [this.left, this.right].filter(Boolean);
  }
}

const heightOf = (eye) => (eye ? eye.height : 0);
const leanOf = (eye) => heightOf(eye.left) - heightOf(eye.right);
const remeasure = (eye) => {
  eye.height = 1 + Math.max(heightOf(eye.left), heightOf(eye.right));
};

class EyeTree {
  constructor(keys = []) {
    this.clear();
    for (const key of keys) this.open(key);
  }

  /** Shut every eye. */
  clear() {
    this.root = null;
    this.eyeCount = 0;
    this.eyeRolls = 0;
  }

  /** Height of the tree. An empty tree has no depth perception. */
  get depthPerception() {
    return heightOf(this.root);
  }

  /** Open a new eye. Returns false if the tree has already seen this key. */
  open(key) {
    assertVisible(key);
    const before = this.eyeCount;
    this.root = this._open(this.root, key);
    return this.eyeCount > before;
  }

  /** Close an eye. Returns false if there was no such eye to close. */
  close(key) {
    assertVisible(key);
    const before = this.eyeCount;
    this.root = this._close(this.root, key);
    return this.eyeCount < before;
  }

  /** Does the tree see this key? */
  see(key) {
    const path = this.gaze(key);
    return path.length > 0 && path[path.length - 1] === key;
  }

  /** The line of sight from the root towards a key: every eye consulted on the way. */
  gaze(key) {
    const path = [];
    let eye = this.root;
    while (eye) {
      path.push(eye.key);
      if (key < eye.key) eye = eye.left;
      else if (key > eye.key) eye = eye.right;
      else break;
    }
    return path;
  }

  /** The smallest key. You have to squint to see it. */
  squint() {
    let eye = this.root;
    while (eye && eye.left) eye = eye.left;
    return eye ? eye.key : undefined;
  }

  /** The largest key. */
  bulge() {
    let eye = this.root;
    while (eye && eye.right) eye = eye.right;
    return eye ? eye.key : undefined;
  }

  /** Pre-order traversal. */
  *foresight(eye = this.root) {
    if (!eye) return;
    yield eye.key;
    yield* this.foresight(eye.left);
    yield* this.foresight(eye.right);
  }

  /** In-order traversal. Keys come out sorted. */
  *insight(eye = this.root) {
    if (!eye) return;
    yield* this.insight(eye.left);
    yield eye.key;
    yield* this.insight(eye.right);
  }

  /** Post-order traversal. Everything is obvious in hindsight. */
  *hindsight(eye = this.root) {
    if (!eye) return;
    yield* this.hindsight(eye.left);
    yield* this.hindsight(eye.right);
    yield eye.key;
  }

  /** Level-order traversal. */
  *eyeLevel() {
    const queue = this.root ? [this.root] : [];
    for (let i = 0; i < queue.length; i++) {
      const eye = queue[i];
      yield eye.key;
      queue.push(...eye.pupils);
    }
  }

  /** The eye-terator. */
  [Symbol.iterator]() {
    return this.insight();
  }

  /**
   * An eye exam: checks search order, balance, recorded heights and the eye count.
   * Returns true when the tree has perfect vision.
   */
  hasPerfectVision() {
    let count = 0;
    const examine = (eye, low, high) => {
      if (!eye) return 0;
      count++;
      if (low !== undefined && !(eye.key > low)) return -1;
      if (high !== undefined && !(eye.key < high)) return -1;
      const left = examine(eye.left, low, eye.key);
      const right = examine(eye.right, eye.key, high);
      if (left < 0 || right < 0 || Math.abs(left - right) > 1) return -1;
      const height = 1 + Math.max(left, right);
      return height === eye.height ? height : -1;
    };
    return examine(this.root) >= 0 && count === this.eyeCount;
  }

  toString() {
    if (!this.root) return '(no eyes)';
    const lines = [`(◉ ${this.root.key})`];
    const draw = (eye, indent) => {
      const pupils = eye.pupils;
      pupils.forEach((pupil, i) => {
        const last = i === pupils.length - 1;
        lines.push(`${indent}${last ? '└── ' : '├── '}(◉ ${pupil.key})`);
        draw(pupil, indent + (last ? '    ' : '│   '));
      });
    };
    draw(this.root, '');
    return lines.join('\n');
  }

  _open(eye, key) {
    if (!eye) {
      this.eyeCount++;
      return new Eye(key);
    }
    if (key < eye.key) eye.left = this._open(eye.left, key);
    else if (key > eye.key) eye.right = this._open(eye.right, key);
    else return eye;
    return this._correct(eye);
  }

  _close(eye, key) {
    if (!eye) return null;
    if (key < eye.key) eye.left = this._close(eye.left, key);
    else if (key > eye.key) eye.right = this._close(eye.right, key);
    else {
      if (!eye.left || !eye.right) {
        this.eyeCount--;
        return eye.left || eye.right;
      }
      // Two pupils: the next key in line takes over this socket.
      let heir = eye.right;
      while (heir.left) heir = heir.left;
      eye.key = heir.key;
      eye.right = this._close(eye.right, heir.key);
    }
    return this._correct(eye);
  }

  /** Corrective lenses: restore balance after a change below this eye. */
  _correct(eye) {
    remeasure(eye);
    const lean = leanOf(eye);
    if (lean > 1) {
      if (leanOf(eye.left) < 0) eye.left = this._rollLeft(eye.left);
      return this._rollRight(eye);
    }
    if (lean < -1) {
      if (leanOf(eye.right) > 0) eye.right = this._rollRight(eye.right);
      return this._rollLeft(eye);
    }
    return eye;
  }

  _rollRight(eye) {
    const riser = eye.left;
    eye.left = riser.right;
    riser.right = eye;
    remeasure(eye);
    remeasure(riser);
    this.eyeRolls++;
    return riser;
  }

  _rollLeft(eye) {
    const riser = eye.right;
    eye.right = riser.left;
    riser.left = eye;
    remeasure(eye);
    remeasure(riser);
    this.eyeRolls++;
    return riser;
  }
}

function assertVisible(key) {
  if (key === null || key === undefined || key !== key) {
    throw new TypeError('The tree cannot see that.');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Eye, EyeTree };
}
