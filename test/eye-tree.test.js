'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Eye, EyeTree } = require('../src/eye-tree.js');

const SEVEN = [42, 17, 73, 8, 29, 61, 88];

test('an empty tree sees nothing', () => {
  const tree = new EyeTree();
  assert.equal(tree.eyeCount, 0);
  assert.equal(tree.depthPerception, 0);
  assert.equal(tree.see(1), false);
  assert.equal(tree.squint(), undefined);
  assert.equal(tree.bulge(), undefined);
  assert.deepEqual([...tree], []);
  assert.equal(String(tree), '(no eyes)');
  assert.ok(tree.hasPerfectVision());
});

test('opened eyes are seen', () => {
  const tree = new EyeTree(SEVEN);
  assert.equal(tree.eyeCount, 7);
  for (const key of SEVEN) assert.ok(tree.see(key));
  assert.equal(tree.see(5), false);
  assert.equal(tree.squint(), 8);
  assert.equal(tree.bulge(), 88);
});

test('the tree refuses to see the same thing twice', () => {
  const tree = new EyeTree([3]);
  assert.equal(tree.open(4), true);
  assert.equal(tree.open(4), false);
  assert.equal(tree.eyeCount, 2);
});

test('the tree cannot see nothing', () => {
  const tree = new EyeTree();
  assert.throws(() => tree.open(undefined), TypeError);
  assert.throws(() => tree.open(null), TypeError);
  assert.throws(() => tree.open(NaN), TypeError);
  assert.throws(() => tree.close(NaN), TypeError);
});

test('foresight, insight, hindsight and eye level', () => {
  const tree = new EyeTree(SEVEN);
  assert.deepEqual([...tree.foresight()], [42, 17, 8, 29, 73, 61, 88]);
  assert.deepEqual([...tree.insight()], [8, 17, 29, 42, 61, 73, 88]);
  assert.deepEqual([...tree.hindsight()], [8, 29, 17, 61, 88, 73, 42]);
  assert.deepEqual([...tree.eyeLevel()], SEVEN);
  assert.equal(tree.eyeRolls, 0);
});

test('the eye-terator yields keys in order', () => {
  const tree = new EyeTree([5, 1, 4, 2, 3]);
  assert.deepEqual([...tree], [1, 2, 3, 4, 5]);
});

test('gaze reports the line of sight', () => {
  const tree = new EyeTree(SEVEN);
  assert.deepEqual(tree.gaze(29), [42, 17, 29]);
  assert.deepEqual(tree.gaze(30), [42, 17, 29]);
  assert.deepEqual(tree.gaze(42), [42]);
});

test('sorted input makes the tree roll its eyes, and stay balanced', () => {
  const tree = new EyeTree();
  for (let key = 1; key <= 1023; key++) tree.open(key);
  assert.equal(tree.eyeCount, 1023);
  assert.equal(tree.depthPerception, 10);
  assert.ok(tree.eyeRolls > 0);
  assert.ok(tree.hasPerfectVision());
});

test('closing a leaf, an eye with one pupil, and an eye with two', () => {
  const tree = new EyeTree([...SEVEN, 5]);

  assert.equal(tree.close(29), true); // leaf
  assert.equal(tree.close(8), true); // one pupil
  assert.equal(tree.close(42), true); // two pupils, at the root
  assert.equal(tree.close(42), false);

  assert.deepEqual([...tree], [5, 17, 61, 73, 88]);
  assert.equal(tree.eyeCount, 5);
  assert.ok(tree.hasPerfectVision());
});

test('every eye has at most two pupils', () => {
  const tree = new EyeTree(SEVEN);
  assert.ok(tree.root instanceof Eye);
  assert.deepEqual(tree.root.pupils.map((eye) => eye.key), [17, 73]);
  assert.deepEqual(tree.root.left.left.pupils, []);
});

test('clear shuts every eye', () => {
  const tree = new EyeTree(SEVEN);
  tree.clear();
  assert.equal(tree.eyeCount, 0);
  assert.equal(tree.root, null);
});

test('toString draws the tree', () => {
  const tree = new EyeTree(SEVEN);
  assert.equal(
    String(tree),
    [
      '(◉ 42)',
      '├── (◉ 17)',
      '│   ├── (◉ 8)',
      '│   └── (◉ 29)',
      '└── (◉ 73)',
      '    ├── (◉ 61)',
      '    └── (◉ 88)',
    ].join('\n'),
  );
});

test('eye exam: random opens and closes agree with a Set', () => {
  // Small deterministic generator so a failure can be reproduced.
  let state = 0x20_20;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const tree = new EyeTree();
  const truth = new Set();
  for (let step = 0; step < 5000; step++) {
    const key = Math.floor(random() * 300);
    if (random() < 0.6) {
      assert.equal(tree.open(key), !truth.has(key));
      truth.add(key);
    } else {
      assert.equal(tree.close(key), truth.delete(key));
    }
    if (step % 50 === 0) assert.ok(tree.hasPerfectVision(), `lost its vision at step ${step}`);
  }
  assert.ok(tree.hasPerfectVision());
  assert.equal(tree.eyeCount, truth.size);
  assert.deepEqual([...tree], [...truth].sort((a, b) => a - b));
});
