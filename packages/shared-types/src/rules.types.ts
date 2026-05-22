// ============================================================
// ELIGIBILITY RULES TYPES
// ============================================================

export enum RuleType {
  VOTING_ZIP = 'voting_zip',
  COUNTY = 'county',
}

export interface EligibilityRule {
  id: string;
  organizationId: string;
  ruleType: RuleType;
  value: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEligibilityRuleInput {
  ruleType: RuleType;
  value: string;
}

export interface UpdateEligibilityRuleInput {
  value?: string;
  isActive?: boolean;
}
