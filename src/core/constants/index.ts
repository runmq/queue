const RUNMQ_PREFIX = "_runmq_"
export const Constants = {
    ROUTER_EXCHANGE_NAME: RUNMQ_PREFIX + "router",
    DEAD_LETTER_ROUTER_EXCHANGE_NAME: RUNMQ_PREFIX + "dead_letter_router",
    RETRY_DELAY_QUEUE_PREFIX: RUNMQ_PREFIX + "retry_delay_",
}