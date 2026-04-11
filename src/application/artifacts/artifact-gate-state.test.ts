import { describe, expect, it } from 'vitest';

import {
  collectSpecialGatePredicateIssues,
  evaluateSpecialGatePredicate,
} from './artifact-gate-state.js';
import type { VariableStore } from '../../domain/variable-value.js';
import { createCompletionGate } from '../../domain/flow-spec.js';

describe('evaluateSpecialGatePredicate', () => {
  it('treats valid and invalid artifact validation states deterministically', () => {
    const validVariables: VariableStore = {
      '_artifacts.deploy_plan': {
        artifactId: 'deploy-plan',
        revisionId: 'rev-2',
        runId: 'run-7',
        validationState: 'valid',
      },
    };
    const invalidVariables: VariableStore = {
      '_artifacts.deploy_plan.validation_state': 'invalid',
      '_artifacts.deploy_plan.artifact_id': 'deploy-plan',
      '_artifacts.deploy_plan.revision_id': 'rev-3',
      '_artifacts.deploy_plan.run_id': 'run-8',
    };

    expect(evaluateSpecialGatePredicate('artifact_valid deploy_plan', validVariables)).toEqual({
      matched: true,
      passed: true,
    });
    expect(evaluateSpecialGatePredicate('artifact_invalid deploy_plan', validVariables)).toEqual({
      matched: true,
      passed: false,
    });
    expect(evaluateSpecialGatePredicate('artifact_invalid deploy_plan', invalidVariables)).toEqual({
      matched: true,
      passed: true,
    });
  });

  it('distinguishes accepted, rejected, and changes-requested review states', () => {
    const acceptedVariables: VariableStore = {
      '_artifacts.deploy_plan.review_state': 'accepted',
      '_artifacts.deploy_plan.artifact_id': 'deploy-plan',
      '_artifacts.deploy_plan.revision_id': 'rev-2',
      '_artifacts.deploy_plan.run_id': 'run-7',
    };
    const rejectedVariables: VariableStore = {
      '_artifacts.deploy_plan.reviewState': 'rejected',
      '_artifacts.deploy_plan.artifactId': 'deploy-plan',
      '_artifacts.deploy_plan.revisionId': 'rev-3',
      '_artifacts.deploy_plan.runId': 'run-8',
    };
    const changesRequestedVariables: VariableStore = {
      '_artifacts.deploy_plan.reviewState': 'request_changes',
      '_artifacts.deploy_plan.artifactId': 'deploy-plan',
      '_artifacts.deploy_plan.revisionId': 'rev-4',
      '_artifacts.deploy_plan.runId': 'run-9',
    };

    expect(
      evaluateSpecialGatePredicate('artifact_accepted deploy_plan', acceptedVariables),
    ).toEqual({
      matched: true,
      passed: true,
    });
    expect(
      evaluateSpecialGatePredicate('artifact_rejected deploy_plan', acceptedVariables),
    ).toEqual({
      matched: true,
      passed: false,
    });
    expect(
      evaluateSpecialGatePredicate('artifact_rejected deploy_plan', rejectedVariables),
    ).toEqual({
      matched: true,
      passed: true,
    });
    expect(
      evaluateSpecialGatePredicate(
        'artifact_changes_requested deploy_plan',
        changesRequestedVariables,
      ),
    ).toEqual({
      matched: true,
      passed: true,
    });
  });

  it('requires approval outcomes to stay bound to the currently present artifact revision', () => {
    const approvedVariables: VariableStore = {
      '_artifacts.deploy_plan': {
        artifactId: 'deploy-plan',
        revisionId: 'rev-2',
        runId: 'run-7',
        validationState: 'valid',
        reviewState: 'accepted',
        revisionState: 'active',
      },
      '_approvals.review_deploy_plan': {
        artifactId: 'deploy-plan',
        revisionId: 'rev-2',
        runId: 'run-7',
        outcome: 'approved',
      },
    };
    const staleApprovalVariables: VariableStore = {
      '_artifacts.deploy_plan': {
        artifactId: 'deploy-plan',
        revisionId: 'rev-3',
        runId: 'run-7',
        validationState: 'valid',
        reviewState: 'unreviewed',
        revisionState: 'active',
      },
      '_approvals.review_deploy_plan': {
        artifactId: 'deploy-plan',
        revisionId: 'rev-2',
        runId: 'run-7',
        outcome: 'approved',
      },
    };
    const rejectedApprovalVariables: VariableStore = {
      ...approvedVariables,
      '_approvals.review_deploy_plan': {
        artifactId: 'deploy-plan',
        revisionId: 'rev-2',
        runId: 'run-7',
        outcome: 'rejected',
      },
    };
    const changesRequestedApprovalVariables: VariableStore = {
      ...approvedVariables,
      '_approvals.review_deploy_plan': {
        artifactId: 'deploy-plan',
        revisionId: 'rev-2',
        runId: 'run-7',
        outcome: 'changes_requested',
      },
    };

    expect(
      evaluateSpecialGatePredicate('approval_passed("review_deploy_plan")', approvedVariables),
    ).toEqual({
      matched: true,
      passed: true,
    });
    expect(
      evaluateSpecialGatePredicate('approval_passed("review_deploy_plan")', staleApprovalVariables),
    ).toEqual({
      matched: true,
      passed: false,
    });
    expect(
      evaluateSpecialGatePredicate(
        'approval_passed("review_deploy_plan")',
        rejectedApprovalVariables,
      ),
    ).toEqual({
      matched: true,
      passed: false,
    });
    expect(
      evaluateSpecialGatePredicate(
        'approval_passed("review_deploy_plan")',
        changesRequestedApprovalVariables,
      ),
    ).toEqual({
      matched: true,
      passed: false,
    });
  });
});

describe('collectSpecialGatePredicateIssues', () => {
  it('reports unsupported nested special-gate syntax once per predicate', () => {
    const issues = collectSpecialGatePredicateIssues([
      {
        predicate: 'any(artifact_status deploy_plan, approval_passed())',
        any: [
          createCompletionGate('artifact_status deploy_plan'),
          createCompletionGate('approval_passed()'),
          createCompletionGate('artifact_status deploy_plan'),
        ],
      },
    ]);

    expect(issues).toEqual([
      {
        predicate: 'artifact_status deploy_plan',
        summary:
          'Unsupported artifact gate "artifact_status deploy_plan". Use explicit predicates such as artifact_valid <ref>, artifact_accepted <ref>, or artifact_active <ref>.',
        action:
          'Replace the generic artifact status check with one supported predicate and one explicit artifact reference.',
      },
      {
        predicate: 'approval_passed()',
        summary: 'approval_passed requires exactly one approval step id.',
        action: 'Provide one non-empty approval step id.',
      },
    ]);
  });
});
