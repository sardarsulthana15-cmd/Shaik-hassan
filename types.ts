export enum StepStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  actionType: 'analysis' | 'generation' | 'extraction' | 'formatting' | 'simulation' | 'search';
  status: StepStatus;
  output?: string;
  sources?: { title: string; uri: string }[];
  error?: string;
}

export interface ExecutionContext {
  originalInput: string;
  stepOutputs: Record<string, string>; // Map step ID to output
}

export interface PlanResponse {
  workflowName: string;
  steps: {
    title: string;
    description: string;
    actionType: 'analysis' | 'generation' | 'extraction' | 'formatting' | 'simulation' | 'search';
  }[];
}