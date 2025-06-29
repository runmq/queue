import {Exceptions} from "@src/core/exceptions/Exceptions";

export class RunMQException {
    constructor(public exception: Exceptions, public details?: Record<string, string | number | Record<string, unknown>>) {
    }
}