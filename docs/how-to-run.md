# How to run EcoTrace (Fedora)

Tested on **Fedora Linux 44 Workstation**, Node 20.20.2, PostgreSQL 18 client
libraries present, Docker 29 and podman available. No `sudo` is required — the
project runs PostgreSQL and MongoDB in Docker containers.

## Prerequisites

```bash
node --version        # v20.x required
npm --version
docker --version
docker compose version  # or just: docker compose
```

## One-line start

```bash
git clone <repo-url> ecotrace   # or use this folder directly
cd ecotrace
cp .env.example .env.local      # credentials are pre-filled for Docker
npm install
docker compose up -d
npm run db:setup
npm run dev
# open http://localhost:3000
```

Demo accounts (password: **password123**):

| Email | Role | Sees |
|---|---|---|
| alice@eco.com | auditor | all departments |
| bob@eco.com | dept_lead | Operations only |
| carol@eco.com | dept_lead | Logistics only |

## Individual commands

### Start the databases

```bash
docker compose up -d
docker compose ps
```

Expected output:

```text
NAME        STATUS
ecotrace-db   Up
ecotrace-mongo Up
```

### Database setup

```bash
npm run db:setup
```

Output confirms 3 departments, 3 users, 9 emission records, 5 credit
transactions, 5 MongoDB documents and pgvector enabled.

### Verify the relational objects

```bash
npm run db:verify
```

Prints tables, views, trigger, routines, compliance summary, pgvector state
and MongoDB document count.

### Start Next.js

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). The root redirects
to `/login`; after sign in you reach `/dashboard`.

## Running on bare-metal PostgreSQL instead of Docker

If you prefer the Fedora system packages:

```bash
sudo dnf install postgresql postgresql-server postgresql-contrib -y
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

Edit `/var/lib/pgsql/data/pg_hba.conf`, change `ident` to `md5` for local TCP,
then `sudo systemctl restart postgresql`.

```bash
sudo -u postgres psql
CREATE DATABASE ecotrace;
CREATE USER ecotrace_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE ecotrace TO ecotrace_user;
\q
```

Then point `.env.local` at the system instance:

```
POSTGRES_URL=postgresql://ecotrace_user:yourpassword@127.0.0.1:5432/ecotrace
```

Run `npm run db:setup` as usual.

## MongoDB options

### Docker (recommended, already configured)

`docker compose` starts `mongo:7` on `127.0.0.1:27017`; `.env.local` already
uses this URI.

### MongoDB Atlas (free tier)

1. Create a cluster at https://mongodb.com/atlas
2. Whitelist your IP (or allow 0.0.0.0/0 for demo)
3. Create a database user and copy the SRV connection string
4. Set `MONGODB_URI` in `.env.local`
5. Insert sample documents or run `npm run db:setup` (it targets whichever URI
   is configured).

### Local MongoDB on Fedora

```bash
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

sudo dnf install mongodb-org -y
sudo systemctl enable --now mongod

# .env.local:
# MONGODB_URI=mongodb://127.0.0.1:27017/ecotrace
```

## Firewall (if the dev port is unreachable)

Fedora's firewalld sometimes blocks loopback-dev ports in some spins:

```bash
sudo firewall-cmd --list-all
sudo firewall-cmd --add-port=3000/tcp --temporary   # dev only
```

## Verification checklist

```bash
# 1. Health endpoint
curl http://localhost:3000/api/health

# 2. Run every API assertion
npm run smoke          # expects 40 passed, 0 failed

# 3. Manual demo flow
#    login as alice@eco.com  -> dashboard (all departments)
#    login as bob@eco.com    -> dashboard / reports (Operations only)
#    /reports -> four SQL tabs + CSV export
#    /search  -> $text then pgvector; upload a vendor report
```

## Project scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start Next.js on :3000 |
| `npm run build` | Production build (type-checked) |
| `npm run start` | Production server |
| `npm run db:setup` | Schema + seed + advanced SQL + Mongo + pgvector |
| `npm run db:verify` | Verify relational/NoSQL objects |
| `npm run smoke` | 40 end-to-end API + UI assertions |
| `npm run screenshots` | Capture docs/screenshots from running app |

## Data persistence

Docker volumes `ecotrace_pgdata` and `ecotrace_mongodata` survive
`docker compose down`. To wipe everything:

```bash
docker compose down -v
npm run db:setup   # re-seed from scratch
```
