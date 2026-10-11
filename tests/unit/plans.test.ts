import { describe, it, expect } from 'vitest';
import { PLANS, aiCreditsForPlan, maxProjectsForPlan, allowsCleanExports } from '../../src/shared/plans';

describe('plan entitlements', () => {
  it('limits the free plan and unlocks paid plans', () => {
    expect(maxProjectsForPlan('free')).toBe(1);
    expect(maxProjectsForPlan('pro')).toBeNull();
    expect(aiCreditsForPlan('free')).toBe(5);
    expect(aiCreditsForPlan('team')).toBeNull();
    expect(allowsCleanExports('free')).toBe(false);
    expect(allowsCleanExports('pro')).toBe(true);
  });
  it('maps every paid plan to a Stripe price env var', () => {
    expect(PLANS.pro.priceEnv).toBe('STRIPE_PRICE_PRO');
    expect(PLANS.team.priceEnv).toBe('STRIPE_PRICE_TEAM');
    expect(PLANS.free.priceEnv).toBeUndefined();
  });
});

describe('unknown plan ids', () => {
  it('fall back to the Free entitlements', () => {
    expect(maxProjectsForPlan('bogus' as never)).toBe(1);
    expect(aiCreditsForPlan('bogus' as never)).toBe(5);
  });
});
