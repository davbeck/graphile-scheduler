import { RunnerOptions } from "./runner";
import { Client } from "pg";

export interface CompiledOptions extends RunnerOptions {
  workerSchema: string;
  escapedWorkerSchema: string;
}

const defaults = {
  workerSchema: process.env.GRAPHILE_WORKER_SCHEMA ?? "graphile_worker",
  schedulerSchema:
    process.env.GRAPHILE_SCHEDULER_SCHEMA ?? "graphile_scheduler",
};

export function processOptions(options: RunnerOptions = {}) {
  return {
    ...defaults,
    ...options,

    escapedWorkerSchema: Client.prototype.escapeIdentifier(
      options.workerSchema ?? defaults.workerSchema
    ),
    escapedSchedulerSchema: Client.prototype.escapeIdentifier(
      options.schedulerSchema ?? defaults.schedulerSchema
    ),
  };
}
