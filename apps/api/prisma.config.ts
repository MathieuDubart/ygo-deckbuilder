import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `prisma generate` n'a pas besoin de DB (build Docker, CI) : fallback inoffensif.
    // migrate / studio échoueront clairement si DATABASE_URL manque.
    url: process.env.DATABASE_URL ?? 'postgresql://missing-database-url',
  },
});
