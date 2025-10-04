export class RunMQMessage<T = any> {
    public static isValid(obj: any) {
        if (typeof obj === "object" && obj !== null) {
            return 'message' in obj && 'meta' in obj &&
                typeof obj.meta === 'object' && obj.meta !== null &&
                'id' in obj.meta && 'publishedAt' in obj.meta &&
                typeof obj.meta.id === 'string' &&
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

    constructor(id: string, publishedAt: number) {
        this.id = id;
        this.publishedAt = publishedAt;
    }
}