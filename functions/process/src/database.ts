import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";

export type DatabaseClient = {
  query(text: string, values?: unknown[]): Promise<unknown>;
};

export type DatabaseConfig = {
  database: string;
  instanceConnectionName: string;
  password: string;
  user: string;
};

const processResultsSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS process_results (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    duration_ms integer NOT NULL CHECK (duration_ms >= 0),
    final_result varchar(16) NOT NULL CHECK (final_result IN ('OK', 'WARNING', 'PHISHING')),
    comment text NOT NULL,
    route varchar(16) NOT NULL CHECK (route IN ('heuristic', 'llm')),
    heuristic_result varchar(16) NOT NULL CHECK (heuristic_result IN ('OK', 'WARNING', 'PHISHING')),
    heuristic_score smallint NOT NULL,
    model_selection text NOT NULL,
    provider text,
    model text,
    confidence double precision CHECK (confidence >= 0 AND confidence <= 1),
    input_tokens integer,
    output_tokens integer,
    rag_corpus_version text,
    rag_hit_count integer,
    details jsonb NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS process_results_created_at_idx ON process_results (created_at DESC)",
  "CREATE INDEX IF NOT EXISTS process_results_final_result_idx ON process_results (final_result, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS process_results_model_idx ON process_results (model, created_at DESC) WHERE model IS NOT NULL",
];

export const databaseConfigFromEnv = (): DatabaseConfig | undefined => {
  const instanceConnectionName = process.env.DB_INSTANCE_CONNECTION_NAME;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  return instanceConnectionName && database && user && password
    ? { instanceConnectionName, database, user, password }
    : undefined;
};

export const createDatabasePool = async (
  config: DatabaseConfig
): Promise<{
  connector: Connector;
  pool: Pool;
}> => {
  const connector = new Connector();
  try {
    const connectionOptions = await connector.getOptions({
      instanceConnectionName: config.instanceConnectionName,
      ipType: IpAddressTypes.PUBLIC,
    });
    const pool = new Pool({
      ...connectionOptions,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 2,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      query_timeout: 10000,
      statement_timeout: 10000,
    });
    pool.on("error", (error: Error) => {
      console.error(
        JSON.stringify({
          event: "postgres_pool_error",
          errorType: error.name,
        })
      );
    });
    return { connector, pool };
  } catch (error) {
    connector.close();
    throw error;
  }
};

export const initializeProcessResultsSchema = async (client: DatabaseClient): Promise<void> => {
  for (const statement of processResultsSchemaStatements) {
    await client.query(statement);
  }
};
