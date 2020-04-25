export const defaults = {
  workerSchema: process.env.GRAPHILE_WORKER_SCHEMA ?? "graphile_worker",
  schedulerSchema:
    process.env.GRAPHILE_SCHEDULER_SCHEMA ?? "graphile_scheduler",
};
