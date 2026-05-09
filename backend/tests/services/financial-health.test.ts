import {
  HealthInputRecord,
  buildFinancialHealthStatus,
  calculateFinancialHealth,
} from '../../src/services/financial.service';

const income = (amount: number): HealthInputRecord => ({
  type: 'income',
  typeCategory: null,
  amount,
});

const essential = (amount: number): HealthInputRecord => ({
  type: 'outgoing',
  typeCategory: 'essential',
  amount,
});

const debt = (amount: number): HealthInputRecord => ({
  type: 'outgoing',
  typeCategory: 'debt-repayment',
  amount,
});

const discretionary = (amount: number): HealthInputRecord => ({
  type: 'outgoing',
  typeCategory: 'discretionary',
  amount,
});

const uncategorisedOutgoing = (amount: number): HealthInputRecord => ({
  type: 'outgoing',
  typeCategory: null,
  amount,
});

describe('calculateFinancialHealth', () => {
  describe('rating thresholds', () => {
    it('returns red when income is zero', () => {
      const health = calculateFinancialHealth([]);
      expect(health.rating).toBe('red');
      expect(health.income).toBe(0);
    });

    it('returns red when essentials exceed income', () => {
      const health = calculateFinancialHealth([income(1000), essential(1500)]);
      expect(health.rating).toBe('red');
    });

    it('returns red when headroom is negative (debt exceeds surplus after essentials)', () => {
      const health = calculateFinancialHealth([income(2000), essential(1000), debt(1500)]);
      expect(health.headroom).toBe(-500);
      expect(health.rating).toBe('red');
    });

    it('returns red when headroom is exactly zero', () => {
      const health = calculateFinancialHealth([income(2000), essential(1000), debt(1000)]);
      expect(health.headroom).toBe(0);
      expect(health.rating).toBe('red');
    });

    it('returns red when the headroom ratio is below 10%', () => {
      // Headroom = 200 / Income = 2800 → 7.14%
      const health = calculateFinancialHealth([income(2800), essential(1600), debt(1000)]);
      expect(health.headroomRatio).toBeLessThan(0.1);
      expect(health.rating).toBe('red');
    });

    it('returns amber for the worked example in the spec (12.5%)', () => {
      const health = calculateFinancialHealth([
        income(2800),
        essential(900), // rent
        essential(400), // food
        essential(150), // travel
        debt(1000),
        discretionary(15),
      ]);
      expect(health.essentialSpend).toBe(1450);
      expect(health.surplusAfterEssentials).toBe(1350);
      expect(health.headroom).toBe(350);
      expect(health.headroomRatio).toBeCloseTo(0.125, 4);
      expect(health.rating).toBe('amber');
    });

    it('returns amber when the headroom ratio sits at the lower boundary (10%)', () => {
      const health = calculateFinancialHealth([
        income(2000),
        essential(800),
        debt(1000), // headroom = 200, ratio = 10%
      ]);
      expect(health.headroomRatio).toBeCloseTo(0.1, 4);
      expect(health.rating).toBe('amber');
    });

    it('returns amber just under the green threshold (~19.9%)', () => {
      const health = calculateFinancialHealth([
        income(1000),
        essential(300),
        debt(501), // headroom = 199, ratio = 19.9%
      ]);
      expect(health.headroomRatio).toBeLessThan(0.2);
      expect(health.rating).toBe('amber');
    });

    it('returns green when the headroom ratio is above 20%', () => {
      const health = calculateFinancialHealth([
        income(3000),
        essential(1000),
        debt(500), // headroom = 1500, ratio = 50%
      ]);
      expect(health.headroomRatio).toBeGreaterThan(0.2);
      expect(health.rating).toBe('green');
    });
  });

  describe('bucketing', () => {
    it('aggregates each bucket across multiple records', () => {
      const health = calculateFinancialHealth([
        income(1500),
        income(1500),
        essential(500),
        essential(400),
        debt(300),
        debt(200),
        discretionary(50),
        discretionary(75),
      ]);
      expect(health.income).toBe(3000);
      expect(health.essentialSpend).toBe(900);
      expect(health.debtRepayments).toBe(500);
      expect(health.discretionarySpend).toBe(125);
    });

    it('treats outgoings with no type_category as discretionary (negotiable by default)', () => {
      const health = calculateFinancialHealth([
        income(2000),
        essential(800),
        uncategorisedOutgoing(100),
      ]);
      expect(health.discretionarySpend).toBe(100);
      expect(health.essentialSpend).toBe(800);
    });

    it('does not count income records toward any expenditure bucket', () => {
      const health = calculateFinancialHealth([income(5000), income(2000)]);
      expect(health.income).toBe(7000);
      expect(health.essentialSpend).toBe(0);
      expect(health.debtRepayments).toBe(0);
      expect(health.discretionarySpend).toBe(0);
    });
  });

  describe('numeric stability', () => {
    it('rounds amounts to 2dp to avoid floating-point drift in the response', () => {
      const health = calculateFinancialHealth([income(100.1), income(100.2), essential(50.05)]);
      expect(health.income).toBe(200.3);
      expect(health.essentialSpend).toBe(50.05);
    });
  });

  describe('disposable income', () => {
    it('returns income minus all outgoings (essentials + debt + discretionary)', () => {
      const health = calculateFinancialHealth([
        income(3100),
        essential(1250),
        debt(1000),
        discretionary(182),
      ]);
      expect(health.disposableIncome).toBe(668);
    });

    it('can be negative when outgoings exceed income', () => {
      const health = calculateFinancialHealth([income(1000), essential(800), debt(400)]);
      expect(health.disposableIncome).toBe(-200);
    });

    it('equals zero when income exactly matches outgoings', () => {
      const health = calculateFinancialHealth([
        income(1500),
        essential(500),
        debt(500),
        discretionary(500),
      ]);
      expect(health.disposableIncome).toBe(0);
    });

    it('matches the over-time progress calculation: income minus all outgoings', () => {
      // The progress widget treats every outgoing the same. The health summary
      // splits them into buckets but disposable income should reconcile.
      const allOutgoings = [
        essential(500),
        debt(300),
        discretionary(125),
        uncategorisedOutgoing(75),
      ];
      const health = calculateFinancialHealth([income(2000), ...allOutgoings]);
      const expected = 2000 - (500 + 300 + 125 + 75);
      expect(health.disposableIncome).toBe(expected);
    });
  });
});

describe('buildFinancialHealthStatus', () => {
  it('attaches a "danger" tone and an under-pressure badge for a red rating', () => {
    const summary = calculateFinancialHealth([income(1000), essential(900), debt(200)]);
    expect(summary.rating).toBe('red');
    const status = buildFinancialHealthStatus(summary);
    expect(status.badgeTone).toBe('danger');
    expect(status.badgeLabel).toMatch(/pressure/i);
    expect(status.headline).toBeTruthy();
    expect(status.body).toBeTruthy();
  });

  it('attaches a "warning" tone and a limited-buffer badge for an amber rating', () => {
    const summary = calculateFinancialHealth([
      income(2800),
      essential(900),
      essential(400),
      essential(150),
      debt(1000),
      discretionary(15),
    ]);
    expect(summary.rating).toBe('amber');
    const status = buildFinancialHealthStatus(summary);
    expect(status.badgeTone).toBe('warning');
    expect(status.badgeLabel).toMatch(/buffer/i);
  });

  it('attaches a "success" tone and an on-track badge for a green rating', () => {
    const summary = calculateFinancialHealth([income(3000), essential(1000), debt(500)]);
    expect(summary.rating).toBe('green');
    const status = buildFinancialHealthStatus(summary);
    expect(status.badgeTone).toBe('success');
    expect(status.badgeLabel).toMatch(/on track/i);
  });

  it('preserves every field from the financial-health summary', () => {
    const summary = calculateFinancialHealth([income(2000), essential(1000), debt(500)]);
    const status = buildFinancialHealthStatus(summary);
    expect(status).toMatchObject(summary);
  });
});
