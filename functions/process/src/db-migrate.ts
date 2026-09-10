import {
  createDatabasePool,
  databaseConfigFromEnv,
  initializeProcessResultsSchema,
} from "./database";

const main = async (): Promise<void> => {
  const config = databaseConfigFromEnv();
  if (!config) {
    throw new Error("DB_INSTANCE_CONNECTION_NAME, DB_NAME, DB_USER, and DB_PASSWORD are required.");
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { connector, pool } = await createDatabasePool(config);
      try {
        await initializeProcessResultsSchema(pool);
        console.info("PostgreSQL process_results schema is ready.");
        return;
      } finally {
        await pool.end();
        connector.close();
      }
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      console.warn(`Database migration attempt ${attempt} failed; retrying.`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
