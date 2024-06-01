/**
 * Interface representing the configuration options for a connection.
 */
export interface ConnectionConfigs {
  /**
   * The port number to connect to.
   * @type {number}
   */
  port: number;

  /**
   * The hostname or IP address to connect to.
   * @type {string}
   */
  host: string;

  /**
   * The username for authentication.
   * @type {string}
   */
  username: string;

  /**
   * The password for authentication.
   * @type {string}
   */
  password: string;
}
