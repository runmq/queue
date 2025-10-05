import {RunMQMessage} from "@src/core/message/RunMQMessage";

export interface Serializer {
    serialize(data: RunMQMessage): string;
}