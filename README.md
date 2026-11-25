# Tree of Eyes

A self-balancing binary search tree in which every node is an eye.

The Scaveng list asked for a "Tree of Eyes". It did not say what kind of tree. This is an AVL tree. Every node is an eye, the eyes follow your cursor, and the whole tree rolls its eyes whenever your inserts force it to rebalance.

```
(◉ 42)
├── (◉ 17)
│   ├── (◉ 8)
│   └── (◉ 29)
└── (◉ 73)
    ├── (◉ 61)
    └── (◉ 88)
```

## See it

Open `index.html` in a browser. There is nothing to install and nothing to build.

- Type a number from 1 to 99 and open an eye.
- Click an eye to close it.
- Insert numbers in sorted order and watch the tree roll its eyes.
- Run a traversal and the eyes light up in order.

Unlike every other tree in computer science, this one grows upward, because we have seen a tree.

## Glossary

| Conventional term | Here |
| --- | --- |
| Node | Eye |
| Children | Pupils (every eye has at most two) |
| Insert | `open(key)` |
| Delete | `close(key)` |
| Contains | `see(key)` |
| Search path | `gaze(key)` |
| Minimum | `squint()` |
| Maximum | `bulge()` |
| Height | Depth perception |
| Rotation | Eye roll |
| Rebalancing | Corrective lenses |
| Pre-order traversal | `foresight()` |
| In-order traversal | `insight()` |
| Post-order traversal | `hindsight()` |
| Level-order traversal | `eyeLevel()` |
| Iterator | Eye-terator |
| Invariant check | `hasPerfectVision()` |

## Use it

The tree is a real data structure and works without the page.

```js
const { EyeTree } = require('./src/eye-tree.js');

const tree = new EyeTree([42, 17, 73]);

tree.open(8);            // true
tree.open(8);            // false, the tree has already seen 8
tree.see(73);            // true
tree.close(17);          // true

[...tree];               // [8, 42, 73], via the eye-terator
[...tree.hindsight()];   // [8, 73, 42]
tree.depthPerception;    // 2
tree.eyeRolls;           // rotations performed so far
console.log(String(tree));
```

## Complexity

| Operation | Time |
| --- | --- |
| `open`, `close`, `see` | O(log n), or the blink of an eye |
| Any traversal | O(n), one look per eye |
| Being watched | O(1), constant |

## Tests

```bash
npm test
```

The suite includes an eye exam: five thousand random opens and closes, checked against a `Set`, with the tree's vision tested along the way. It needs Node 18 or newer and no dependencies.

## FAQ

**Is this what the task meant?**
We have looked into it.

**Why does it stop at 31 eyes?**
The tree has seen enough.

**Does it scale?**
The data structure does. Sorted input of 1,023 keys gives a depth perception of exactly 10. The page stops at 31 because past that it gets hard to maintain eye contact.

**Has this been peer reviewed?**
It has been reviewed by its pupils.

## License

MIT. See [LICENSE](LICENSE).
