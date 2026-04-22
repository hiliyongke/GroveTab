import { describe, it, expect } from 'vitest';

describe('Canopy smoke test', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have correct app name', () => {
    const appName = 'Canopy';
    expect(appName).toBe('Canopy');
  });
});
