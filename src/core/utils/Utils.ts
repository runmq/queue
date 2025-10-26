import {randomUUID} from 'crypto';
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {Exceptions} from "@src/core/exceptions/Exceptions";

export class RunMQUtils {
    public static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public static generateUUID(): string {
        return randomUUID();
    }

    public static assertRecord(message: unknown): asserts message is Record<string, any> {
        if (typeof message !== 'object' || message === null || Array.isArray(message)) {
            throw new RunMQException(Exceptions.INVALID_MESSAGE_FORMAT, {});
        }
    }
}