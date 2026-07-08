export interface Config {
  wiz?: {
    /**
     * @visibility frontend
     */
    enabled?: boolean;
    /**
     * @visibility frontend
     */
    dashboardLink?: string;
    /**
     * @visibility secret
     */
    clientId?: string;
    /**
     * @visibility secret
     */
    clientSecret?: string;
    /**
     *
     * @visibility secret
     */
    authUrl?: string;
    /**
     * @visibility secret
     */
    apiEndpointUrl?: string;
    /**
     * Time-to-live for cached Wiz GraphQL responses, in seconds.
     * Defaults to 300 (5 minutes).
     */
    cacheTtlSeconds?: number;
    /**
     * Maximum number of concurrent Wiz GraphQL requests in-flight per
     * backend instance. Defaults to 5.
     */
    maxConcurrentRequests?: number;
    /**
     * Maximum number of retry attempts on HTTP 429 / GraphQL
     * RATE_LIMIT_EXCEEDED responses before surfacing a rate-limit error.
     * Defaults to 3.
     */
    maxRetries?: number;
  };
}
