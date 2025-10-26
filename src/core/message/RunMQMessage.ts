export class RunMQMessage<T = any> {
    public static isValid(obj: any) {
        if (typeof obj === "object" && obj !== null) {
            return 'message' in obj && 'meta' in obj &&
                typeof obj.message === 'object' && obj.message !== null &&
                Array.isArray(obj.message) === false &&
                typeof obj.meta === 'object' && obj.meta !== null &&
                'id' in obj.meta &&
                'correlationId' in obj.meta &&
                'publishedAt' in obj.meta &&
                typeof obj.meta.id === 'string' &&
                typeof obj.meta.correlationId === 'string' &&
                typeof obj.meta.publishedAt === 'number';
        }
        return false;
    }


    readonly message: T;

    readonly meta: RunMQMessageMeta;

    constructor(message: T, meta: RunMQMessageMeta) {
        this.message = message;
        this.meta = meta;
    }
}

export class RunMQMessageMeta {
    readonly id: string;
    readonly publishedAt: number;
    readonly correlationId: string;

    constructor(id: string, publishedAt: number, correlationId: string) {
        this.id = id;
        this.correlationId = correlationId;
        this.publishedAt = publishedAt;
    }
}