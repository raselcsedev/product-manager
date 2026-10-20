# Deploying Product Manager

This runs the whole app (database, API, website and https) with Docker.

## What you need
- A computer or server with **Docker** and **Docker Compose** installed
- For a real website: a **domain name** pointing to the server, with ports **80 and 443** open

## 1. Try it on your own computer first
```bash
cp .env.example .env
```
Open `.env` and fill in the three secrets. Make each one with `openssl rand -hex 32`
(on Windows without openssl, any long random text of letters and digits works):
```
MYSQL_ROOT_PASSWORD=...
MYSQL_APP_PASSWORD=...
JWT_KEY=...
```
Leave `SITE_ADDRESS=http://localhost` and `SITE_URL=http://localhost`. Then:
```bash
docker compose up -d --build
docker compose ps          # all four services should become "running" / "healthy"
```
Open http://localhost. **The first account you register becomes the Admin.**

> Stop your XAMPP Apache first if it uses port 80, and stop `npm run dev` / `dotnet run` (ports are not shared,
> but it avoids confusion). The Docker database is a separate, empty one: your XAMPP data is not touched.

## 2. A real server
In `.env` set your domain:
```
SITE_ADDRESS=shop.example.com
SITE_URL=https://shop.example.com
```
Run `docker compose up -d --build`. Caddy requests a free https certificate automatically
(the domain must already point to the server, and ports 80 and 443 must be reachable).

## Everyday commands
```bash
docker compose logs -f backend      # what the API is doing (errors appear here, never in the browser)
docker compose logs -f frontend
docker compose restart backend
docker compose down                 # stop everything (your data stays, it is in volumes)
```

## Updating to a new version
```bash
git pull                            # or copy the new files
docker compose up -d --build
```
Your database and uploaded pictures live in Docker volumes, so they survive updates.

### Database changes
The API applies **migrations** by itself when it starts (`Database__AutoMigrate`). When a new version needs a new
column or table, the migration for it is part of the new version, so `docker compose up -d --build` is all you do.
Take a backup first (see below). A migration that removes a column removes its data.

Want to review the SQL before it runs? Turn `Database__AutoMigrate` off in `docker-compose.yml`, and from `backend/`:
```bash
dotnet ef migrations script --idempotent -o update.sql
```
Then run `update.sql` against the database yourself. More in `backend/MIGRATIONS.md`.

> **If you started this stack before migrations existed** (it created the tables another way), the old database
> has tables but no migration history, and the API will stop with "table already exists". Start clean with
> `docker compose down -v` (this DELETES the Docker database and uploads) and `docker compose up -d --build` again,
> or restore a backup into the fresh database.

## Backups (do this before you need it)
```bash
# the database
docker compose exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction product_crud' > backup-$(date +%F).sql

# the uploaded pictures
docker run --rm -v product-crud_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```
(The volume is named `<folder name>_uploads`; check with `docker volume ls`.)
Keep copies **off the server**, and test restoring one now and then.

## Before you go live: checklist
- [ ] `.env` is not in Git (`git status` must not list it)
- [ ] The three secrets are long and random, and not used anywhere else
- [ ] `SITE_URL` is your real `https://` address
- [ ] Only ports 80 and 443 are open on the firewall (not 3306, 5080 or 3000)
- [ ] You registered the Admin account first, and nobody else could do it before you
- [ ] You made a backup **and** tested restoring it
- [ ] `docker compose logs backend` shows "The database is ready." and no errors
- [ ] You tried the public shop in a private window, and a wrong-password login 6 times (it should lock)

## What protects the app (and what does not)
**Built in:** passwords are hashed with BCrypt; login lockout and per-address request limits; strict validation;
every user can only reach their own data; security headers and a content policy; errors never show internal
details; the server refuses to start in production with the development secret; the containers run as
non-root users; the database is not reachable from outside.

**Not covered, and worth adding as you grow:**
- Email notifications and password reset (needs an email service)
- Two-factor login
- Keeping the lockout counters and rate limits in a shared store (Redis) if you run several copies of the API
- Automatic, monitored backups and alerts when the site is down
- Keeping Docker images and packages up to date (rebuild regularly: `docker compose build --pull`)
