import Mock = jest.Mock;

export class LoggerTestHelpers {
    static async assertLoggedWithCountAndParameters(loggerFunction: any, message: string, parameters: any, count: number) {
        const log = (loggerFunction as Mock).mock.calls.filter(call => call[0] === message);
        expect(log.length).toBe(count);
        expect(log[0][1]).toMatchObject(parameters);
    }

    static async assertLoggedWithCount(loggerFunction: any, message: string, count: number) {
        const calls = (loggerFunction as Mock).mock.calls
        const log = (loggerFunction as Mock).mock.calls.filter(call => call[0] === message);
        expect(log.length).toBe(count);
    }
}