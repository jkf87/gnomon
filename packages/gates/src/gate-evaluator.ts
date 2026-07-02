import type { EvaluationGate, EvaluationGateDefaults } from './evaluation-gates.js';

export type GateFinalStage = 'stage2' | 'stage3_consensus';
export type LoopClosureDecision = 'close' | 'continue';

export interface RubricGateJudgement {
  readonly ac_compliance: boolean;
  readonly score: number;
  readonly uncertainty: number;
}

export interface GateEvaluationAttempt {
  readonly stage2: RubricGateJudgement;
  readonly stage3_consensus?: readonly RubricGateJudgement[];
}

export interface EvaluatedGateResult {
  readonly ac_hash: string;
  readonly source: EvaluationGate['source'];
  readonly verification_method: EvaluationGate['verification_method'];
  readonly critical: boolean;
  readonly final_stage: GateFinalStage;
  readonly consensus_resolved: boolean;
  readonly human_review_required: false;
  readonly ac_compliance: boolean;
  readonly score: number;
  readonly uncertainty: number;
  readonly passed: boolean;
}

export interface LoopClosureResult {
  readonly decision: LoopClosureDecision;
  readonly gate_results: readonly EvaluatedGateResult[];
  readonly critical_failures: readonly string[];
  readonly noncritical_pass_ratio: number;
}

export class GateEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GateEvaluationError';
  }
}

function assertUnitInterval(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new GateEvaluationError(`${fieldName} must be a finite number in [0,1]`);
  }
}

function assertValidJudgement(judgement: RubricGateJudgement, label: string): void {
  assertUnitInterval(judgement.score, `${label}.score`);
  assertUnitInterval(judgement.uncertainty, `${label}.uncertainty`);
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function consensusComplies(judgements: readonly RubricGateJudgement[]): boolean {
  const compliantCount = judgements.filter((judgement) => judgement.ac_compliance).length;
  return compliantCount > judgements.length / 2;
}

function average(field: 'score' | 'uncertainty', judgements: readonly RubricGateJudgement[]): number {
  const sum = judgements.reduce((total, judgement) => total + judgement[field], 0);
  return roundScore(sum / judgements.length);
}

function resolveJudgement(
  gate: EvaluationGate,
  attempt: GateEvaluationAttempt,
  defaults: EvaluationGateDefaults,
): Omit<EvaluatedGateResult, 'passed'> {
  assertValidJudgement(attempt.stage2, `${gate.ac_hash}.stage2`);

  if (attempt.stage2.uncertainty <= defaults.uncertainty_trigger) {
    return {
      ac_hash: gate.ac_hash,
      source: gate.source,
      verification_method: gate.verification_method,
      critical: gate.critical,
      final_stage: 'stage2',
      consensus_resolved: false,
      human_review_required: false,
      ac_compliance: attempt.stage2.ac_compliance,
      score: roundScore(attempt.stage2.score),
      uncertainty: roundScore(attempt.stage2.uncertainty),
    };
  }

  const consensus = attempt.stage3_consensus ?? [];
  if (consensus.length === 0) {
    throw new GateEvaluationError(`${gate.ac_hash} requires Stage 3 consensus for uncertainty>${defaults.uncertainty_trigger}`);
  }

  for (const judgement of consensus) {
    assertValidJudgement(judgement, `${gate.ac_hash}.stage3_consensus`);
  }

  return {
    ac_hash: gate.ac_hash,
    source: gate.source,
    verification_method: gate.verification_method,
    critical: gate.critical,
    final_stage: 'stage3_consensus',
    consensus_resolved: true,
    human_review_required: false,
    ac_compliance: consensusComplies(consensus),
    score: average('score', consensus),
    uncertainty: average('uncertainty', consensus),
  };
}

function evaluateGate(
  gate: EvaluationGate,
  attempt: GateEvaluationAttempt,
  defaults: EvaluationGateDefaults,
): EvaluatedGateResult {
  const resolved = resolveJudgement(gate, attempt, defaults);
  return {
    ...resolved,
    passed: resolved.ac_compliance && resolved.score >= defaults.satisfaction_threshold,
  };
}

function noncriticalPassRatio(results: readonly EvaluatedGateResult[]): number {
  const noncritical = results.filter((result) => !result.critical);
  if (noncritical.length === 0) return 1;
  const passed = noncritical.filter((result) => result.passed).length;
  return roundScore(passed / noncritical.length);
}

export function evaluateLoopClosure(
  gates: readonly EvaluationGate[],
  attemptsByHash: Readonly<Record<string, GateEvaluationAttempt>>,
  defaults: EvaluationGateDefaults,
): LoopClosureResult {
  const gateResults = gates.map((gate) => {
    const attempt = attemptsByHash[gate.ac_hash];
    if (!attempt) {
      throw new GateEvaluationError(`Missing evaluation attempt for AC hash ${gate.ac_hash}`);
    }
    return evaluateGate(gate, attempt, defaults);
  });
  const criticalFailures = gateResults.filter((result) => result.critical && !result.passed).map((result) => result.ac_hash);
  const ratio = noncriticalPassRatio(gateResults);
  const decision = criticalFailures.length === 0 && ratio >= defaults.noncritical_pass_ratio ? 'close' : 'continue';

  return {
    decision,
    gate_results: gateResults,
    critical_failures: criticalFailures,
    noncritical_pass_ratio: ratio,
  };
}
