import { createHash } from 'node:crypto';

export * from './gate-evaluator.js';

export type GateVerificationMethod = 'deterministic' | 'rubric_llm_judge';
export type GateSource = 'override' | 'derived' | 'default';

export interface EvaluationGateEvidence {
  readonly kind: string;
  readonly required_artifacts: readonly string[];
  readonly inspection: string;
}

export interface EvaluationGateCalibrationExample {
  readonly input: string;
  readonly ac_compliance: boolean;
  readonly score: number;
}

export interface EvaluationGateCalibration {
  readonly passing: EvaluationGateCalibrationExample;
  readonly failing: EvaluationGateCalibrationExample;
}

export interface EvaluationGate {
  readonly ac_hash: string;
  readonly condition: readonly string[];
  readonly evidence: EvaluationGateEvidence;
  readonly calibration: EvaluationGateCalibration;
  readonly critical: boolean;
  readonly verification_method: GateVerificationMethod;
  readonly source: GateSource;
}

export interface EvaluationGateDefaults {
  readonly satisfaction_threshold: number;
  readonly uncertainty_trigger: number;
  readonly noncritical_pass_ratio: number;
}

export interface GateMaterializationResult {
  readonly targetedAcceptanceCriteria: readonly string[];
  readonly derivedGatesByHash: Readonly<Record<string, EvaluationGate>>;
  readonly effectiveGates: readonly EvaluationGate[];
  readonly defaults: EvaluationGateDefaults;
}

export interface GateMaterializationOptions {
  readonly targetedAcceptanceCriteria?: readonly string[];
  readonly overrideGatesByHash?: Readonly<Record<string, EvaluationGate>>;
  readonly derivedGatesByHash?: Readonly<Record<string, EvaluationGate>>;
}

const DEFAULT_GATE_POLICY: EvaluationGateDefaults = Object.freeze({
  satisfaction_threshold: 0.8,
  uncertainty_trigger: 0.3,
  noncritical_pass_ratio: 0.8,
});

const QUALITATIVE_AC_HINTS = [
  'without friction',
  'friction',
  'qualitative',
  'rubric',
  'judge',
  'user',
  'usable',
  'satisfied',
  'clear',
  'good',
] as const;

function normalizeAcceptanceCriterion(ac: string): string {
  return ac.replace(/\s+/g, ' ').trim();
}

function hashAcceptanceCriterion(ac: string): string {
  return createHash('sha256').update(normalizeAcceptanceCriterion(ac)).digest('hex').slice(0, 16);
}

function isTopLevelYamlKey(line: string): boolean {
  return /^\s*[A-Za-z_][A-Za-z0-9_]*:/.test(line);
}

function leadingSpaceCount(line: string): number {
  return line.length - line.trimStart().length;
}

function stripYamlInlineComment(value: string): string {
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && doubleQuoted) {
      escaped = true;
      continue;
    }
    if (char === "'" && !doubleQuoted) singleQuoted = !singleQuoted;
    if (char === '"' && !singleQuoted) doubleQuoted = !doubleQuoted;
    if (char === '#' && !singleQuoted && !doubleQuoted && (index === 0 || /\s/.test(value[index - 1] ?? ''))) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value.trimEnd();
}

function unquoteYamlString(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function parseTopLevelStringList(yaml: string, key: string): string[] {
  const lines = yaml.split(/\r?\n/);
  const keyPattern = new RegExp(`^${key}:\\s*(?:#.*)?$`);
  const keyLineIndex = lines.findIndex((line) => keyPattern.test(line));
  if (keyLineIndex < 0) return [];

  const items: string[] = [];
  let current: string[] = [];
  const keyIndent = leadingSpaceCount(lines[keyLineIndex] ?? '');

  for (const line of lines.slice(keyLineIndex + 1)) {
    if (line.trim().length > 0 && leadingSpaceCount(line) <= keyIndent && isTopLevelYamlKey(line)) break;

    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem) {
      if (current.length > 0) items.push(normalizeAcceptanceCriterion(current.join(' ')));
      current = [unquoteYamlString(stripYamlInlineComment(listItem[1] ?? '').trim())];
      continue;
    }

    if (current.length > 0 && /^\s+\S/.test(line)) {
      current.push(unquoteYamlString(stripYamlInlineComment(line.trim()).trim()));
    }
  }

  if (current.length > 0) items.push(normalizeAcceptanceCriterion(current.join(' ')));
  return items;
}

function evidenceKindFor(ac: string): string {
  const evidenceMatch = /\(evidence\s*-\s*([^)]+)\)/i.exec(ac);
  if (evidenceMatch?.[1]) return evidenceMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return 'derived_ac_evidence';
}

function isQualitativeAcceptanceCriterion(ac: string): boolean {
  const lower = ac.toLowerCase();
  return QUALITATIVE_AC_HINTS.some((hint) => lower.includes(hint));
}

function deriveEvaluationGate(ac: string): EvaluationGate {
  const normalized = normalizeAcceptanceCriterion(ac);
  const acHash = hashAcceptanceCriterion(normalized);
  const qualitative = isQualitativeAcceptanceCriterion(normalized);
  const verificationMethod: GateVerificationMethod = qualitative ? 'rubric_llm_judge' : 'deterministic';
  const scoreCondition = qualitative
    ? `rubric judge returns ac_compliance=true and score>=${DEFAULT_GATE_POLICY.satisfaction_threshold}`
    : 'deterministic check returns pass=true';

  return {
    ac_hash: acHash,
    condition: [
      `targeted AC content hash equals ${acHash}`,
      scoreCondition,
      'required evidence artifacts are present and inspectable',
    ],
    evidence: {
      kind: evidenceKindFor(normalized),
      required_artifacts: ['loop-run evaluation artifact', 'AC-specific evidence referenced by the criterion'],
      inspection: 'Judge inspects the evidence and emits a binary pass/fail result before loop closure.',
    },
    calibration: {
      passing: {
        input: `Artifact "${evidenceKindFor(normalized)}" shows the requested outcome for: ${normalized}`,
        ac_compliance: true,
        score: 1,
      },
      failing: {
        input: `Artifact "${evidenceKindFor(normalized)}" is absent or shows the requested outcome did not occur for: ${normalized}`,
        ac_compliance: false,
        score: 0,
      },
    },
    critical: /\bcritical\b/i.test(normalized),
    verification_method: verificationMethod,
    source: 'derived',
  };
}

function defaultEvaluationGate(ac: string): EvaluationGate {
  const normalized = normalizeAcceptanceCriterion(ac);
  const acHash = hashAcceptanceCriterion(normalized);
  return {
    ac_hash: acHash,
    condition: [
      `targeted AC content hash equals ${acHash}`,
      `semantic score>=${DEFAULT_GATE_POLICY.satisfaction_threshold}`,
      `uncertainty<=${DEFAULT_GATE_POLICY.uncertainty_trigger} or consensus has resolved`,
    ],
    evidence: {
      kind: 'inherited_pipeline_default',
      required_artifacts: ['loop-run evaluation artifact'],
      inspection: 'Apply inherited mechanical, semantic, and consensus defaults to produce a final binary gate result.',
    },
    calibration: {
      passing: {
        input: `Default evaluator observes compliant evidence and score 1 for: ${normalized}`,
        ac_compliance: true,
        score: 1,
      },
      failing: {
        input: `Default evaluator observes missing evidence and score 0 for: ${normalized}`,
        ac_compliance: false,
        score: 0,
      },
    },
    critical: false,
    verification_method: 'deterministic',
    source: 'default',
  };
}

function defaultsSnapshot(): EvaluationGateDefaults {
  return Object.freeze({ ...DEFAULT_GATE_POLICY });
}

export function materializeEffectiveEvaluationGates(
  seedYaml: string,
  options: GateMaterializationOptions = {},
): GateMaterializationResult {
  const targetedAcceptanceCriteria = options.targetedAcceptanceCriteria?.map(normalizeAcceptanceCriterion) ??
    parseTopLevelStringList(seedYaml, 'acceptance_criteria');
  const derivedGatesByHash: Record<string, EvaluationGate> = {};
  const effectiveGates: EvaluationGate[] = [];

  for (const ac of targetedAcceptanceCriteria) {
    const acHash = hashAcceptanceCriterion(ac);
    const derivedGate = options.derivedGatesByHash ? options.derivedGatesByHash[acHash] : deriveEvaluationGate(ac);
    if (derivedGate) derivedGatesByHash[acHash] = derivedGate;
    effectiveGates.push(options.overrideGatesByHash?.[acHash] ?? derivedGate ?? defaultEvaluationGate(ac));
  }

  return {
    targetedAcceptanceCriteria,
    derivedGatesByHash: Object.freeze({ ...derivedGatesByHash }),
    effectiveGates,
    defaults: defaultsSnapshot(),
  };
}
