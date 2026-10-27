import { describe, expect, it } from 'vitest';

import { shouldReload } from './build';

describe('shouldReload', () => {
  it('reloads once when the server is on a newer build', () => {
    expect(shouldReload('a', 'b', null)).toBe(true);
    expect(shouldReload('a', 'b', 'b')).toBe(false);
  });

  it('leaves a matching or unknown build alone', () => {
    expect(shouldReload('a', 'a', null)).toBe(false);
    expect(shouldReload('a', null, null)).toBe(false);
    expect(shouldReload('', 'b', null)).toBe(false);
  });
});
