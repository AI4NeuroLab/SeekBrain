import type { WorkflowRunContext } from "../../../workflows/index.ts";
import {
  DependencyInstallApprovalQueue,
  resolvePythonInstallEnvironment,
  SerializedReviewGate,
} from "../../dependency-install.ts";
import { dependencyInstallReviewTitle, selectDependencyInstallReview } from "../../tui/review-selectors.ts";
import type { Json } from "../runtime-types.ts";

export interface DependencyApprovalQueueFactoryDependencies {
  projectRoot: string;
  loadEnv(cwd: string): Promise<NodeJS.ProcessEnv>;
  resolveRun(cwd: string, runId?: string): Promise<WorkflowRunContext>;
  updateState(run: WorkflowRunContext, patch: Json): Promise<unknown>;
}

export function createDependencyApprovalQueueFactory(deps: DependencyApprovalQueueFactoryDependencies) {
  const { projectRoot: PROJECT_ROOT, loadEnv, resolveRun, updateState } = deps;
  return async function createDependencyApprovalQueue(
  context: Json,
  parentRunId?: string,
  reviewGate = new SerializedReviewGate(),
) {
  const env = await loadEnv(PROJECT_ROOT);
  const cwd = String(context.cwd || PROJECT_ROOT);
  const parent = parentRunId ? await resolveRun(cwd, parentRunId) : undefined;
  return new DependencyInstallApprovalQueue({
    environment: resolvePythonInstallEnvironment(env),
    env,
    initialApproveAll: parent?.state.research_planning?.agent_full_auto === true
      || parent?.state.research_execution?.dependency_install_approve_all === true,
    onApproveAll: parentRunId
      ? async () => {
          const current = await resolveRun(cwd, parentRunId);
          const researchExecution = current.state.research_execution || {};
          await updateState(current, {
            research_execution: {
              ...researchExecution,
              dependency_install_approve_all: true,
              dependency_install_approve_all_at: researchExecution.dependency_install_approve_all_at || new Date().toISOString(),
            },
          });
        }
      : undefined,
    review: (request) => reviewGate.run(async () => {
      const selection = await selectDependencyInstallReview(context, {
        title: dependencyInstallReviewTitle(request),
        yesLabel: `Yes, run pip install ${request.packageName}`,
        yesToAllLabel: request.parentRunId
          ? "Yes, allow all pip installs for all remaining tasks"
          : "Yes, allow all pip installs for this run",
      });
      return selection.decision;
    }),
  });
}
;
}
