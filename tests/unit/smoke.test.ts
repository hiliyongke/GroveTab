import { describe, it, expect } from 'vitest';
import { BRAND } from '@/shared/config/brand';

describe('GroveTab smoke test', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have correct app name', () => {
    expect(BRAND.name).toBe('GroveTab');
  });
});
