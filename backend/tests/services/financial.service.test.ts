import { calculateProgressForWindow } from '../../src/services/financial.service';

describe('calculateProgressForWindow', () => {
  describe('multi-month windows', () => {
    it('maps the highest disposable income to 100 and the lowest to 0', () => {
      expect(calculateProgressForWindow([100, 500, 1000])).toEqual([0, 44, 100]);
    });

    it('rounds intermediate values to the nearest integer', () => {
      // Min=0, Max=3 → values map to 0, 33.33, 66.66, 100 → 0, 33, 67, 100.
      expect(calculateProgressForWindow([0, 1, 2, 3])).toEqual([0, 33, 67, 100]);
    });

    it('returns 50 for every period when all months are equal', () => {
      expect(calculateProgressForWindow([0, 0, 0])).toEqual([50, 50, 50]);
      expect(calculateProgressForWindow([500, 500, 500, 500])).toEqual([50, 50, 50, 50]);
      expect(calculateProgressForWindow([-100, -100])).toEqual([50, 50]);
    });

    it('handles a window that goes up then down (non-linear trajectory)', () => {
      // Disposable incomes Jan→Jun: 200, 600, 1000, 1500 (peak), 800, 400.
      // Min=200, Max=1500, range=1300.
      expect(calculateProgressForWindow([200, 600, 1000, 1500, 800, 400])).toEqual([
        0, 31, 62, 100, 46, 15,
      ]);
    });

    it('handles negative disposable incomes by anchoring 0 to the window min', () => {
      // Min=-200, Max=2000, range=2200.
      expect(calculateProgressForWindow([2000, 1000, 200, 1300, 600, -200])).toEqual([
        100, 55, 18, 68, 36, 0,
      ]);
    });
  });

  describe('single-month windows', () => {
    it('returns 100 when the only month has positive disposable income', () => {
      expect(calculateProgressForWindow([1])).toEqual([100]);
      expect(calculateProgressForWindow([5000])).toEqual([100]);
    });

    it('returns 0 when the only month has zero disposable income', () => {
      expect(calculateProgressForWindow([0])).toEqual([0]);
    });

    it('returns 0 when the only month has negative disposable income', () => {
      expect(calculateProgressForWindow([-1])).toEqual([0]);
      expect(calculateProgressForWindow([-2500])).toEqual([0]);
    });
  });

  describe('empty windows', () => {
    it('returns an empty array', () => {
      expect(calculateProgressForWindow([])).toEqual([]);
    });
  });
});
