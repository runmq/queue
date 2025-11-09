import {Constants} from "@src/core/constants";

export class ConsumerCreatorUtils {
    static getDLQTopicName(topic: string): string {
        return Constants.DLQ_QUEUE_PREFIX + topic;
    }
    static getRetryDelayTopicName(topic: string): string {
        return Constants.RETRY_DELAY_QUEUE_PREFIX + topic;
    }

    static getMessageTTLPolicyName(topic: string): string {
        return Constants.MESSAGE_TTL_OPERATOR_POLICY_PREFIX + topic;
    }
}