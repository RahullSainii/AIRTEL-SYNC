export interface ManualReviewTask {
  gstin: string;
  reason: string;
  consentId: string;
}

export class HumanFallbackQueue {
  private readonly tasks: ManualReviewTask[] = [];

  enqueue(task: ManualReviewTask): void {
    this.tasks.push(task);
  }

  list(): readonly ManualReviewTask[] {
    return this.tasks;
  }
}
