import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { evaluateLoopClosure, materializeEffectiveEvaluationGates } from '../dist/evaluation-gates.js';

test('materializeEffectiveEvaluationGates: fixture seed gives every targeted AC exactly one judgeable gate', async () => {
  const seedPath = path.resolve('seeds/backward-design-gates.seed.yaml');
  const seedYaml = await readFile(seedPath, 'utf8');

  const result = materializeEffectiveEvaluationGates(seedYaml);

  assert.equal(result.targetedAcceptanceCriteria.length, 6);
  assert.equal(result.effectiveGates.length, result.targetedAcceptanceCriteria.length);
  assert.equal(new Set(result.effectiveGates.map((gate) => gate.ac_hash)).size, result.effectiveGates.length);
  assert.deepEqual(Object.keys(result.derivedGatesByHash).sort(), result.effectiveGates.map((gate) => gate.ac_hash).sort());
  assert.deepEqual(result.defaults, {
    satisfaction_threshold: 0.8,
    uncertainty_trigger: 0.3,
    noncritical_pass_ratio: 0.8,
  });

  for (const gate of result.effectiveGates) {
    assert.equal(gate.source, 'derived');
    assert.ok(Array.isArray(gate.condition));
    assert.ok(gate.condition.length > 0);
    assert.ok(gate.condition.every((condition) => typeof condition === 'string' && condition.length > 0));
    assert.equal(typeof gate.evidence.kind, 'string');
    assert.ok(gate.evidence.kind.length > 0);
    assert.equal(typeof gate.calibration.passing.input, 'string');
    assert.doesNotMatch(gate.calibration.passing.input, /^Evidence satisfies/);
    assert.equal(gate.calibration.passing.ac_compliance, true);
    assert.equal(typeof gate.calibration.failing.input, 'string');
    assert.doesNotMatch(gate.calibration.failing.input, /^Evidence is missing/);
    assert.equal(gate.calibration.failing.ac_compliance, false);
    assert.equal(typeof gate.critical, 'boolean');
    assert.ok(['deterministic', 'rubric_llm_judge'].includes(gate.verification_method));
  }
});

test('materializeEffectiveEvaluationGates: resolves override over derived over default for runtime targeted leaves', () => {
  const runtimeLeaf = 'Runtime decomposed sub-AC emits telemetry evidence';
  const seedYaml = 'acceptance_criteria: # valid YAML comment\n- Top-level AC remains string based\n';
  const derivedResult = materializeEffectiveEvaluationGates(seedYaml, {
    targetedAcceptanceCriteria: [runtimeLeaf],
  });
  const derivedGate = derivedResult.effectiveGates[0];
  assert.equal(derivedGate.source, 'derived');

  const defaultResult = materializeEffectiveEvaluationGates(seedYaml, {
    targetedAcceptanceCriteria: [runtimeLeaf],
    derivedGatesByHash: {},
  });
  const defaultGate = defaultResult.effectiveGates[0];
  assert.equal(defaultGate.source, 'default');
  assert.equal(defaultGate.ac_hash, derivedGate.ac_hash);

  const overrideResult = materializeEffectiveEvaluationGates(seedYaml, {
    targetedAcceptanceCriteria: [runtimeLeaf],
    overrideGatesByHash: {
      [derivedGate.ac_hash]: {
        ...defaultGate,
        condition: ['override binary condition passes'],
        critical: true,
        source: 'override',
      },
    },
  });
  const overrideGate = overrideResult.effectiveGates[0];
  assert.equal(overrideGate.source, 'override');
  assert.deepEqual(overrideGate.condition, ['override binary condition passes']);
  assert.equal(overrideGate.critical, true);
});

test('materializeEffectiveEvaluationGates: default snapshots cannot change future derived gate thresholds', () => {
  const qualitativeSeed = 'acceptance_criteria: # comment is valid\n- Users complete the main task without friction\n';
  const firstResult = materializeEffectiveEvaluationGates(qualitativeSeed);
  assert.throws(() => {
    firstResult.defaults.satisfaction_threshold = 0.1;
  }, TypeError);

  const nextResult = materializeEffectiveEvaluationGates(qualitativeSeed);
  assert.match(nextResult.effectiveGates[0].condition.join(' '), /score>=0\.8/);
});

test('materializeEffectiveEvaluationGates: editing AC text invalidates stored derived gate until re-derived', () => {
  // Given: a derived gate persisted for the original AC content hash.
  const originalAc = 'CLI emits a loop closure report';
  const editedAc = 'CLI emits a loop closure report with reviewer evidence';
  const originalResult = materializeEffectiveEvaluationGates('', {
    targetedAcceptanceCriteria: [originalAc],
  });
  const originalGate = originalResult.effectiveGates[0];
  const persistedDerivedGates = {
    [originalGate.ac_hash]: originalGate,
  };

  // When: the AC text changes but only the stale derived-gate store is available.
  const staleResult = materializeEffectiveEvaluationGates('', {
    targetedAcceptanceCriteria: [editedAc],
    derivedGatesByHash: persistedDerivedGates,
  });
  const staleGate = staleResult.effectiveGates[0];

  // Then: the old derived gate cannot pass as the effective gate for the edited AC.
  assert.notEqual(staleGate.ac_hash, originalGate.ac_hash);
  assert.equal(staleGate.source, 'default');
  assert.deepEqual(staleResult.derivedGatesByHash, {});

  // When: the edited AC is re-derived.
  const rederivedResult = materializeEffectiveEvaluationGates('', {
    targetedAcceptanceCriteria: [editedAc],
  });
  const rederivedGate = rederivedResult.effectiveGates[0];

  // Then: a new current-hash derived gate becomes effective.
  assert.equal(rederivedGate.source, 'derived');
  assert.equal(rederivedGate.ac_hash, staleGate.ac_hash);
  assert.notEqual(rederivedGate.ac_hash, originalGate.ac_hash);
  assert.deepEqual(Object.keys(rederivedResult.derivedGatesByHash), [rederivedGate.ac_hash]);
});

test('materializeEffectiveEvaluationGates: parses indented string AC lists and strips YAML item comments', () => {
  const seedYaml = [
    'acceptance_criteria:',
    '  - First AC # valid YAML item comment',
    '  - "Second # AC keeps quoted hash marker"',
    'metadata:',
    '  seed_id: example',
    '',
  ].join('\n');

  const result = materializeEffectiveEvaluationGates(seedYaml);

  assert.deepEqual(result.targetedAcceptanceCriteria, [
    'First AC',
    'Second # AC keeps quoted hash marker',
  ]);
  assert.equal(result.effectiveGates.length, 2);
});

test('materializeEffectiveEvaluationGates: ignores nested acceptance_criteria fields', () => {
  const seedYaml = [
    'metadata:',
    '  acceptance_criteria:',
    '    - Nested should not win',
    'acceptance_criteria:',
    '  - Top level should win',
    '',
  ].join('\n');

  const result = materializeEffectiveEvaluationGates(seedYaml);

  assert.deepEqual(result.targetedAcceptanceCriteria, ['Top level should win']);
  assert.equal(result.effectiveGates.length, 1);
});

test('evaluateLoopClosure: qualitative rubric gates resolve score and uncertainty before close/continue', () => {
  const seedYaml = [
    'acceptance_criteria:',
    '  - Users complete the main task without friction',
    '  - Users understand the next action clearly',
    '',
  ].join('\n');
  const materialized = materializeEffectiveEvaluationGates(seedYaml);
  const [frictionGate, clarityGate] = materialized.effectiveGates;

  assert.equal(frictionGate.verification_method, 'rubric_llm_judge');
  assert.equal(clarityGate.verification_method, 'rubric_llm_judge');

  const passingDecision = evaluateLoopClosure(
    materialized.effectiveGates,
    {
      [frictionGate.ac_hash]: {
        stage2: { ac_compliance: true, score: 0.86, uncertainty: 0.12 },
      },
      [clarityGate.ac_hash]: {
        stage2: { ac_compliance: true, score: 0.77, uncertainty: 0.52 },
        stage3_consensus: [
          { ac_compliance: true, score: 0.84, uncertainty: 0.18 },
          { ac_compliance: true, score: 0.88, uncertainty: 0.22 },
          { ac_compliance: false, score: 0.74, uncertainty: 0.24 },
        ],
      },
    },
    materialized.defaults,
  );

  assert.equal(passingDecision.decision, 'close');
  assert.equal(passingDecision.gate_results.length, 2);
  assert.equal(passingDecision.gate_results[0].final_stage, 'stage2');
  assert.equal(passingDecision.gate_results[0].ac_compliance, true);
  assert.equal(passingDecision.gate_results[0].score, 0.86);
  assert.equal(passingDecision.gate_results[0].passed, true);
  assert.equal(passingDecision.gate_results[1].final_stage, 'stage3_consensus');
  assert.equal(passingDecision.gate_results[1].consensus_resolved, true);
  assert.equal(passingDecision.gate_results[1].ac_compliance, true);
  assert.equal(passingDecision.gate_results[1].score, 0.82);
  assert.equal(passingDecision.gate_results[1].passed, true);
  assert.equal(passingDecision.gate_results[1].human_review_required, false);

  assert.throws(
    () => evaluateLoopClosure(
      materialized.effectiveGates,
      {
        [frictionGate.ac_hash]: {
          stage2: { ac_compliance: true, score: 0.86, uncertainty: 0.12 },
        },
        [clarityGate.ac_hash]: {
          stage2: { ac_compliance: true, score: 0.9, uncertainty: 0.31 },
        },
      },
      materialized.defaults,
    ),
    /requires Stage 3 consensus/,
  );

  const failingDecision = evaluateLoopClosure(
    materialized.effectiveGates,
    {
      [frictionGate.ac_hash]: {
        stage2: { ac_compliance: true, score: 0.81, uncertainty: 0.1 },
      },
      [clarityGate.ac_hash]: {
        stage2: { ac_compliance: true, score: 0.79, uncertainty: 0.1 },
      },
    },
    materialized.defaults,
  );

  assert.equal(failingDecision.decision, 'continue');
  assert.equal(failingDecision.gate_results[1].ac_compliance, true);
  assert.equal(failingDecision.gate_results[1].score, 0.79);
  assert.equal(failingDecision.gate_results[1].passed, false);
});
