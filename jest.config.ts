import type {Config} from '@jest/types';

const config: Config.InitialOptions = {
        preset: 'ts-jest',
        verbose: true,
        moduleFileExtensions: [
            "ts",
            "js"
        ],
        testMatch: [
            "<rootDir>/tests/**/*.test.ts",
        ],
        moduleNameMapper: {
            "^@src/(.*)$": "<rootDir>/src/$1",
            "^@tests/(.*)$": "<rootDir>/tests/$1"
        },
        setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
        testTimeout: 30000
    }
;
export default config;