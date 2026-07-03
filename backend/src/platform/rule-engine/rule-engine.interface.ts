export interface RuleContext {
  businessId: string;
  ruleSetCode: string;
  inputs: Record<string, unknown>;
  asOf?: Date;
}

export interface FiredRule {
  ruleId: string;
  priority: number;
  condition: Record<string, unknown>;
  effect: Record<string, unknown>;
}

export interface RuleResult {
  ruleSetCode: string;
  firedRules: FiredRule[];
  output: Record<string, unknown>;
  explanation: string;
  confidence: number;
  computedAt: Date;
  ruleSnapshotVersion: string;
}
