import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoopClosure } from '../dist/evaluation-gates.js';

const DEFAULTS = Object.freeze({
  satisfaction_threshold: 0.8,
  uncertainty_trigger: 0.3,
  noncritical_pass_ratio: 0.8,
});

function gate(acHash, critical = false) {
  return Object.freeze({
    ac_hash: acHash,
    condition: Object.freeze(['binary condition passes']),
    evidence: Object.freeze({
      kind: 'closure_policy_test',
      required_artifacts: Object.freeze(['evaluation result']),
      inspection: 'Inspect the deterministic fixture result.',
    }),
    calibration: Object.freeze({
      passing: Object.freeze({
        input: 'known passing fixture',
        ac_compliance: true,
        score: 1,
      }),
      failing: Object.freeze({
        input: 'known failing fixture',
        ac_compliance: false,
        score: 0,
      }),
    }),
    critical,
    verification_method: 'rubric_llm_judge',
    source: 'derived',
  });
}

function stage2(acCompliance, score, uncertainty = 0.1) {
  return Object.freeze({
    ac_compliance: acCompliance,
    score,
    uncertainty,
  });
}

test('evaluateLoopClosure: closes when all critical gates pass and noncritical ratio meets threshold', () => {
  // Given: one critical gate passes, and exactly four of five noncritical gates pass.
  const gates = [
    gate('critical', true),
    gate('noncritical-1'),
    gate('noncritical-2'),
    gate('noncritical-3'),
    gate('noncritical-4'),
    gate('noncritical-5'),
  ];

  // When: the evaluator resolves every gate below the uncertainty trigger.
  const result = evaluateLoopClosure(
    gates,
    {
      critical: { stage2: stage2(true, 0.9) },
      'noncritical-1': { stage2: stage2(true, 0.82) },
      'noncritical-2': { stage2: stage2(true, 0.83) },
      'noncritical-3': { stage2: stage2(true, 0.84) },
      'noncritical-4': { stage2: stage2(true, 0.85) },
      'noncritical-5': { stage2: stage2(false, 0.2) },
    },
    DEFAULTS,
  );

  // Then: the threshold comparison is inclusive, so 4/5 closes at the default 0.8 ratio.
  assert.equal(result.decision, 'close');
  assert.deepEqual(result.critical_failures, []);
  assert.equal(result.noncritical_pass_ratio, 0.8);
});

test('evaluateLoopClosure: continues when any critical gate fails even if all noncritical gates pass', () => {
  // Given: a failed critical gate and two passing noncritical gates.
  const gates = [
    gate('critical', true),
    gate('noncritical-1'),
    gate('noncritical-2'),
  ];

  // When: the evaluator applies the closure policy.
  const result = evaluateLoopClosure(
    gates,
    {
      critical: { stage2: stage2(false, 0.95) },
      'noncritical-1': { stage2: stage2(true, 0.9) },
      'noncritical-2': { stage2: stage2(true, 0.9) },
    },
    DEFAULTS,
  );

  // Then: critical failure forces continue regardless of noncritical ratio.
  assert.equal(result.decision, 'continue');
  assert.deepEqual(result.critical_failures, ['critical']);
  assert.equal(result.noncritical_pass_ratio, 1);
});

test('evaluateLoopClosure: continues when noncritical pass ratio is below policy threshold', () => {
  // Given: the critical gate passes, but only two of three noncritical gates pass.
  const gates = [
    gate('critical', true),
    gate('noncritical-1'),
    gate('noncritical-2'),
    gate('noncritical-3'),
  ];

  // When: the evaluator computes the aggregate noncritical closure ratio.
  const result = evaluateLoopClosure(
    gates,
    {
      critical: { stage2: stage2(true, 0.95) },
      'noncritical-1': { stage2: stage2(true, 0.9) },
      'noncritical-2': { stage2: stage2(true, 0.9) },
      'noncritical-3': { stage2: stage2(true, 0.79) },
    },
    DEFAULTS,
  );

  // Then: a clean critical set is insufficient when the noncritical ratio is below 0.8.
  assert.equal(result.decision, 'continue');
  assert.deepEqual(result.critical_failures, []);
  assert.equal(result.noncritical_pass_ratio, 0.67);
});

test('evaluateLoopClosure: resolves consensus before producing close and continue decisions', () => {
  // Given: two otherwise identical runs with a high-uncertainty noncritical gate.
  const gates = [
    gate('critical', true),
    gate('consensus-noncritical'),
  ];

  // When: Stage 3 consensus resolves the uncertain gate to pass.
  const passingResult = evaluateLoopClosure(
    gates,
    {
      critical: { stage2: stage2(true, 0.95) },
      'consensus-noncritical': {
        stage2: stage2(true, 0.81, 0.6),
        stage3_consensus: [
          stage2(true, 0.84, 0.2),
          stage2(true, 0.86, 0.18),
          stage2(false, 0.7, 0.2),
        ],
      },
    },
    DEFAULTS,
  );

  // Then: the closure decision uses the resolved consensus result with no human escalation.
  assert.equal(passingResult.decision, 'close');
  assert.equal(passingResult.gate_results[1].final_stage, 'stage3_consensus');
  assert.equal(passingResult.gate_results[1].consensus_resolved, true);
  assert.equal(passingResult.gate_results[1].human_review_required, false);
  assert.equal(passingResult.gate_results[1].passed, true);

  // When: Stage 3 consensus resolves the uncertain gate to fail.
  const failingResult = evaluateLoopClosure(
    gates,
    {
      critical: { stage2: stage2(true, 0.95) },
      'consensus-noncritical': {
        stage2: stage2(true, 0.81, 0.6),
        stage3_consensus: [
          stage2(false, 0.7, 0.2),
          stage2(false, 0.74, 0.18),
          stage2(true, 0.92, 0.2),
        ],
      },
    },
    DEFAULTS,
  );

  // Then: the loop continues from the final consensus result, not the uncertain Stage 2 result.
  assert.equal(failingResult.decision, 'continue');
  assert.equal(failingResult.gate_results[1].final_stage, 'stage3_consensus');
  assert.equal(failingResult.gate_results[1].consensus_resolved, true);
  assert.equal(failingResult.gate_results[1].human_review_required, false);
  assert.equal(failingResult.gate_results[1].passed, false);
});
