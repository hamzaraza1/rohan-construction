#!/bin/bash
# Runs once, when the PostgreSQL data volume is first created.
# Creates the application database with two NON-superuser roles:
#   rc_owner    - owns the schema, runs migrations, performs writes
#   rc_readonly - SELECT only; used for every read in the application
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_pw="$APP_OWNER_PASSWORD" -v ro_pw="$APP_READONLY_PASSWORD" -v dbname="$APP_DB_NAME" <<'SQL'
CREATE ROLE rc_owner LOGIN PASSWORD :'owner_pw' NOSUPERUSER NOCREATEROLE NOCREATEDB;
CREATE ROLE rc_readonly LOGIN PASSWORD :'ro_pw' NOSUPERUSER NOCREATEROLE NOCREATEDB;
CREATE DATABASE :"dbname" OWNER rc_owner;
REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO rc_owner, rc_readonly;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$APP_DB_NAME" <<'SQL'
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO rc_owner;
SQL
