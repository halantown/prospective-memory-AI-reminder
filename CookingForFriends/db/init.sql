-- CookingForFriends — PostgreSQL initialization script
-- Executed automatically on first container start via docker-entrypoint-initdb.d

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant full privileges on public schema to the application user
-- (The database and user are created by POSTGRES_DB / POSTGRES_USER env vars)
GRANT ALL PRIVILEGES ON DATABASE cooking_for_friends TO cff;
GRANT ALL PRIVILEGES ON SCHEMA public TO cff;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cff;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cff;

-- Note: Table creation is handled by SQLAlchemy's Base.metadata.create_all()
-- on application startup. This script only sets up the database-level config.
