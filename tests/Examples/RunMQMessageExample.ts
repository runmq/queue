import {MessageExample} from "@tests/Examples/MessageExample";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";
import {RunMQUtils} from "@src/core/utils/Utils";

export class RunMQMessageExample {
    static random(
        message = MessageExample.person(),
        meta = new RunMQMessageMetaExample().random()
    ): RunMQMessage {
        return new RunMQMessage(
            message,
            meta
        );
    }

    static person() {
        return RunMQMessageExample.random(
            MessageExample.person()
        );
    }
}

export class RunMQMessageMetaExample {
    random(): RunMQMessageMeta {
        return new RunMQMessageMeta(
           RunMQUtils.generateUUID(),
            Date.now(),
            RunMQUtils.generateUUID()
        );
    }
}