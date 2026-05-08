import { greet } from '../src/index';

describe('greet', () => {
  it('returns a greeting with the provided name', () => {
    expect(greet('World')).toBe('Hello, World!');
  });
});
