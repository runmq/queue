export class MessageTestUtils {
    static buffer(data: Record<string, any>): Buffer {
        return Buffer.from(JSON.stringify(data));
    }
}