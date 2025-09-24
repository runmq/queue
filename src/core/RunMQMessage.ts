import {Expose, Type} from "class-transformer";
import "reflect-metadata";

export class RunMQMessage<T = Record<string, never>> {
    @Expose()
    readonly message: T;

    @Expose()
    @Type(() => RunMQMessageMeta)
    readonly meta: RunMQMessageMeta;

    constructor(message: T, meta: RunMQMessageMeta) {
        if (!message || !meta) {
            throw new Error("Message and Meta cannot be empty");
        }
        this.message = message;
        this.meta = meta;
    }

    copy(message: T = this.message, meta: RunMQMessageMeta = this.meta) {
        return new RunMQMessage<T>(message, meta);
    }
}

export class RunMQMessageMeta {
    @Expose()
    readonly id: string;
    @Expose()
    readonly publishedAt: number;

    constructor(id: string, publishedAt: number) {
        if (!id || !publishedAt) {
            throw new Error("Meta id and publishedAt cannot be empty");
        }
        this.id = id;
        this.publishedAt = publishedAt;
    }
}