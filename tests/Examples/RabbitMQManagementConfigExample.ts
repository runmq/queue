export class RabbitMQManagementConfigExample {
    static valid() {
        return {
            url: 'http://localhost:15673',
            username: 'test',
            password: 'test',
        };
    }

    static invalid() {
        return {
            url: 'http://invalid-host:15673',
            username: 'invalid',
            password: 'invalid',
        };
    }

    static invalidCredentials() {
        return {
            url: 'http://localhost:15673',
            username: 'wrong',
            password: 'wrong',
        };
    }

    static nonRoutableHost() {
        return {
            url: 'http://1.2.3.4:15672',
            username: 'test',
            password: 'test',
        }
    }
}