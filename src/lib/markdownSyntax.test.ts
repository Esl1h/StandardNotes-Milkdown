import { describe, expect, it } from 'vitest';
import { roundTrip } from '../mocks/roundTrip';

describe('list markers', () => {
  it.each([
    ['a bullet list', '- a\n- b\n'],
    ['a task list', '- [ ] t\n'],
    ['a nested list', '- a\n  - b\n'],
  ])(
    'keeps the dash of %s',
    async (_name, markdown) => {
      expect(await roundTrip(markdown)).toBe(markdown);
    },
    20000
  );

  it('writes a list that used asterisks with dashes', async () => {
    expect(await roundTrip('* a\n* b\n')).toBe('- a\n- b\n');
  }, 20000);
});
