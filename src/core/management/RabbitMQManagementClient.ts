import * as http from "node:http";
import * as https from "node:https";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RabbitMQManagementConfig} from "@src";
import {RabbitMQOperatorPolicy} from "@src/types";

interface ManagementResponse {
    status: number;
    ok: boolean;
    body: string;
}

export class RabbitMQManagementClient {
    constructor(
        private config: RabbitMQManagementConfig,
        private logger: RunMQLogger
    ) {}

    private getAuthHeader(): string {
        const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
        return `Basic ${credentials}`;
    }

    private request(
        urlString: string,
        method: string,
        body?: unknown
    ): Promise<ManagementResponse> {
        const url = new URL(urlString);
        const lib = url.protocol === 'https:' ? https : http;
        const payload = body !== undefined ? JSON.stringify(body) : undefined;

        const headers: Record<string, string> = {
            'Authorization': this.getAuthHeader()
        };
        if (payload !== undefined) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(payload).toString();
        }

        return new Promise((resolve, reject) => {
            const req = lib.request(
                {
                    protocol: url.protocol,
                    hostname: url.hostname,
                    port: url.port || (url.protocol === 'https:' ? 443 : 80),
                    path: `${url.pathname}${url.search}`,
                    method,
                    headers
                },
                (res) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk: Buffer) => chunks.push(chunk));
                    res.on('end', () => {
                        const status = res.statusCode ?? 0;
                        resolve({
                            status,
                            ok: status >= 200 && status < 300,
                            body: Buffer.concat(chunks).toString('utf8')
                        });
                    });
                    res.on('error', reject);
                }
            );
            req.on('error', reject);
            if (payload !== undefined) req.write(payload);
            req.end();
        });
    }

    public async createOrUpdateOperatorPolicy(vhost: string, policy: RabbitMQOperatorPolicy): Promise<boolean> {
        try {
            const url = `${this.config.url}/api/operator-policies/${vhost}/${encodeURIComponent(policy.name)}`;
            const response = await this.request(url, 'PUT', {
                pattern: policy.pattern,
                definition: policy.definition,
                priority: policy.priority || 0,
                "apply-to": policy["apply-to"]
            });

            if (!response.ok) {
                this.logger.error(`Failed to create operator policy: ${response.status} - ${response.body}`);
                return false;
            }

            this.logger.info(`Successfully set operator policy: ${policy.name}`);
            return true;
        } catch (error) {
            this.logger.error(`Error creating operator policy: ${error}`);
            return false;
        }
    }

    public async getOperatorPolicy(vhost: string, policyName: string): Promise<RabbitMQOperatorPolicy | null> {
        try {
            const url = `${this.config.url}/api/operator-policies/${vhost}/${encodeURIComponent(policyName)}`;
            const response = await this.request(url, 'GET');

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                this.logger.error(`Failed to get operator policy: ${response.status} - ${response.body}`);
                return null;
            }

            return JSON.parse(response.body);
        } catch (error) {
            this.logger.error(`Error getting operator policy: ${error}`);
            return null;
        }
    }

    public async deleteOperatorPolicy(vhost: string, policyName: string): Promise<boolean> {
        try {
            const url = `${this.config.url}/api/operator-policies/${vhost}/${encodeURIComponent(policyName)}`;
            const response = await this.request(url, 'DELETE');

            if (!response.ok && response.status !== 404) {
                this.logger.error(`Failed to delete operator policy: ${response.status} - ${response.body}`);
                return false;
            }

            this.logger.info(`Successfully deleted operator policy: ${policyName}`);
            return true;
        } catch (error) {
            this.logger.error(`Error deleting operator policy: ${error}`);
            return false;
        }
    }

    public async checkManagementPluginEnabled(): Promise<boolean> {
        try {
            const url = `${this.config.url}/api/overview`;
            const response = await this.request(url, 'GET');
            return response.ok;
        } catch (error) {
            this.logger.warn(`Management plugin not accessible: ${error}`);
            return false;
        }
    }

    /**
     * Creates or updates a RabbitMQ parameter.
     * Parameters are custom key-value stores that can hold any JSON data.
     *
     * @param name - The parameter name
     * @param value - The parameter value (any JSON-serializable object)
     */
    public async setParameter<T>(
        name: string,
        value: T
    ): Promise<boolean> {
        try {
            const url = `${this.config.url}/api/global-parameters/${encodeURIComponent(name)}`;
            const response = await this.request(url, 'PUT', {value});

            if (!response.ok) {
                this.logger.error(`Failed to set parameter ${name}: ${response.status} - ${response.body}`);
                return false;
            }

            this.logger.info(`Successfully set parameter: ${name}`);
            return true;
        } catch (error) {
            this.logger.error(`Error setting parameter: ${error}`);
            return false;
        }
    }

    /**
     * Gets a RabbitMQ parameter.
     *
     * @param name - The parameter name
     */
    public async getParameter<T>(
        name: string
    ): Promise<T | null> {
        try {
            const url = `${this.config.url}/api/global-parameters/${encodeURIComponent(name)}`;
            const response = await this.request(url, 'GET');

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                this.logger.error(`Failed to get parameter ${name}: ${response.status} - ${response.body}`);
                return null;
            }

            const data = JSON.parse(response.body);
            return data.value as T;
        } catch (error) {
            this.logger.error(`Error getting parameter: ${error}`);
            return null;
        }
    }

    /**
     * Deletes a RabbitMQ parameter.
     *
     * @param name - The parameter name
     */
    public async deleteParameter(
        name: string
    ): Promise<boolean> {
        try {
            const url = `${this.config.url}/api/global-parameters/${encodeURIComponent(name)}`;
            const response = await this.request(url, 'DELETE');

            if (!response.ok && response.status !== 404) {
                this.logger.error(`Failed to delete parameter ${name}: ${response.status} - ${response.body}`);
                return false;
            }

            this.logger.info(`Successfully deleted parameter: ${name}`);
            return true;
        } catch (error) {
            this.logger.error(`Error deleting parameter: ${error}`);
            return false;
        }
    }
}
