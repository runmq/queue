import {RunMQLogger} from "@src/core/logging/RunMQLogger";

export const MockedRunMQLogger: RunMQLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    verbose: jest.fn(),
}