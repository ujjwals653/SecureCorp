/**
 * Node runner for the shared crypto-core test cases.
 * Uses Node's built-in Web Crypto (globalThis.crypto.subtle) — the same
 * W3C API the browser exposes — so no mocking and no other module needed.
 *
 *   npm test
 */
import { test, describe } from 'node:test';
import { cases } from './cases.js';

const groups = [...new Set(cases.map((c) => c.group))];

for (const group of groups) {
  describe(group, () => {
    for (const c of cases.filter((x) => x.group === group)) {
      const label = c.dod ? `${c.name}  [DoD #${c.dod}]` : c.name;
      test(label, c.run);
    }
  });
}
