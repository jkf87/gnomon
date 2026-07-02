import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materializeEffectiveEvaluationGates } from '../dist/evaluation-gates.js';

test('materializeEffectiveEvaluationGates: property - same Seed and overrides deterministically merge override over derived over default', () => {
  const targetedAcceptanceCriteria = [
    'Override leaf emits binary completion evidence',
    'Derived leaf emits binary completion evidence',
    'Default leaf emits binary completion evidence',
  ];
  const seedYaml = [
    'acceptance_criteria:',
    ...targetedAcceptanceCriteria.map((criterion) => `  - ${criterion}`),
    '',
  ].join('\n');
  const baseResult = materializeEffectiveEvaluationGates(seedYaml, { targetedAcceptanceCriteria });
  const [overrideBaseGate, derivedBaseGate, defaultBaseGate] = baseResult.effectiveGates;

  const overrideGate = {
    ...overrideBaseGate,
    condition: ['override condition wins'],
    evidence: {
      ...overrideBaseGate.evidence,
      kind: 'override_evidence',
    },
    critical: true,
    source: 'override',
  };
  const shadowedDerivedGate = {
    ...overrideBaseGate,
    condition: ['shadowed derived condition loses'],
    evidence: {
      ...overrideBaseGate.evidence,
      kind: 'shadowed_derived_evidence',
    },
    critical: false,
    source: 'derived',
  };
  const derivedGate = {
    ...derivedBaseGate,
    condition: ['derived condition wins when no override exists'],
    evidence: {
      ...derivedBaseGate.evidence,
      kind: 'derived_evidence',
    },
    critical: false,
    source: 'derived',
  };

  const forwardOptions = {
    targetedAcceptanceCriteria,
    overrideGatesByHash: {
      [overrideBaseGate.ac_hash]: overrideGate,
    },
    derivedGatesByHash: {
      [overrideBaseGate.ac_hash]: shadowedDerivedGate,
      [derivedBaseGate.ac_hash]: derivedGate,
    },
  };
  const reverseOptions = {
    targetedAcceptanceCriteria,
    overrideGatesByHash: {
      [overrideBaseGate.ac_hash]: overrideGate,
    },
    derivedGatesByHash: {
      [derivedBaseGate.ac_hash]: derivedGate,
      [overrideBaseGate.ac_hash]: shadowedDerivedGate,
    },
  };

  for (const options of [forwardOptions, reverseOptions]) {
    const firstResult = materializeEffectiveEvaluationGates(seedYaml, options);
    const secondResult = materializeEffectiveEvaluationGates(seedYaml, options);

    assert.deepEqual(secondResult.effectiveGates, firstResult.effectiveGates);
    assert.deepEqual(
      firstResult.effectiveGates.map((gate) => gate.source),
      ['override', 'derived', 'default'],
    );
    assert.deepEqual(firstResult.effectiveGates[0], overrideGate);
    assert.deepEqual(firstResult.effectiveGates[1], derivedGate);
    assert.equal(firstResult.effectiveGates[2].source, 'default');
    assert.equal(firstResult.effectiveGates[2].ac_hash, defaultBaseGate.ac_hash);
  }

  assert.deepEqual(
    materializeEffectiveEvaluationGates(seedYaml, forwardOptions).effectiveGates,
    materializeEffectiveEvaluationGates(seedYaml, reverseOptions).effectiveGates,
  );
});
