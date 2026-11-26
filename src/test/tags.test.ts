import { expect, it } from 'vitest';
import { normalizeTags } from '../lib/tags';
it('saves custom comma separated tags and removes empty or duplicate entries', () => {
  expect(normalizeTags([' Cultivation, System ', 'system', '', ' Fast Paced '])).toEqual(['Cultivation', 'System', 'Fast Paced']);
});