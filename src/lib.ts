import { defaults } from "./config";
import { RunnerOptions } from "./runner";
import { Client } from "pg";

export interface CompiledOptions extends RunnerOptions {
  workerSchema: string;
  escapedWorkerSchema: string;
}

export function processOptions(options: RunnerOptions) {
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
