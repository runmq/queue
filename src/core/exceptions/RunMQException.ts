import {Exceptions} from "@src/core/exceptions/Exceptions";

export class RunMQException extends Error {
    constructor(public exception: Exceptions, public details: Record<string, string | number | Record<string, unknown>>) {
        super(`RunMQ Exception: ${exception}`);
    }
}