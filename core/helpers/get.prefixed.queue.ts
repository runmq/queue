import { CONSTANTS } from "@core/constants";

export function GetPrefixedQueue(queue: string): string {
  return CONSTANTS.QUEUE_PREFIX + queue;
}