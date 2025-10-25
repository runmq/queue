import { randomUUID } from 'crypto';

export class RunMQUtils {
    public static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public static generateUUID(): string {
        return randomUUID();
    }
}