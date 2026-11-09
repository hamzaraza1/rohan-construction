# 5. Deployment on the Hostinger VPS (Ubuntu 24.04, KVM 2)

> Phase 7 covers the full go-live and the restore drill. The files below already exist and
> were checked during Phase 1:
> * the Caddy config validates in all three address modes
> * `init-roles.sh`, the migrations and the seed run against a fresh `postgres:16` container
> * backup + restore-test ran against PostgreSQL 16
>
> **Not yet run end-to-end:** `docker compose build` of the app image. The development
> sandbox cannot reach the Debian package mirror. That build is the first step of Phase 7
> on the VPS.

## 5.1 Server hardening (once)

```bash
# as root on a fresh VPS
adduser deploy && usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
```
Edit `/etc/ssh/sshd_config.d/hardening.conf`:
```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
```
```bash
systemctl restart ssh            # test a new SSH session as deploy BEFORE closing this one
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
apt update && apt install -y unattended-upgrades fail2ban && dpkg-reconfigure -plow unattended-upgrades
```
Also turn on the Hostinger panel firewall with the same three ports. PostgreSQL is **not** published on the host.

Docker publishes ports by writing iptables rules directly, which bypasses UFW. This stack only publishes Caddy's 80/443, so this is safe. Do not add `ports:` to `postgres` or `app`.

## 5.2 Install Docker and the app

```bash
curl -fsSL https://get.docker.com | sh && usermod -aG docker deploy
sudo mkdir -p /opt/rohan-construction && sudo chown deploy: /opt/rohan-construction
git clone <repo-url> /opt/rohan-construction && cd /opt/rohan-construction
cp .env.production.example .env.production && chmod 600 .env.production
# fill in the passwords:  openssl rand -base64 32
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production run --rm migrate npm run db:seed    # creates Hamza's admin login
```
Open `http://<VPS-IP>` to test. **Do not enter real financial data over plain HTTP.**

## 5.3 HTTPS

* **No domain yet:** in `.env.production` set `SITE_ADDRESS=https://<VPS-IP>`, `CADDY_TLS=internal`, `COOKIE_SECURE=true`, then run `docker compose --env-file .env.production up -d`. Browsers will warn once about the self-signed certificate. To remove the warning, install Caddy's root certificate on the three partners' devices: `docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt`.
* **With a domain:** point an A record at the VPS, then set `SITE_ADDRESS=erp.yourdomain.com`, `CADDY_TLS=you@email.com`, `COOKIE_SECURE=true`. Caddy obtains and renews Let's Encrypt certificates automatically.

## 5.4 Backups

```bash
sudo apt install -y rclone && rclone config        # set up the off-site remote (decision D8)
echo 'RCLONE_REMOTE=offsite:rohan-backups' | sudo tee /etc/default/rohan-backup
sudo tee /etc/cron.d/rohan-backup <<'CRON'
15 2 * * * deploy . /etc/default/rohan-backup; export RCLONE_REMOTE; cd /opt/rohan-construction && deploy/scripts/backup.sh >> /home/deploy/rohan-backup.log 2>&1
CRON
```
* Each run produces a `pg_dump -Fc` dump, a tarball of the uploads, and SHA-256 checksums. The dump is checked to be readable.
* Retention: 14 daily backups plus 12 monthly backups (the 1st of each month), both locally and off-site.
* **Monthly restore drill:** `deploy/scripts/restore-test.sh` restores the newest dump into a scratch database, prints row counts, and drops the scratch database. The live database is never touched.
* **Disaster recovery:** `deploy/scripts/restore.sh backups/daily/<stamp>/db.dump`. It requires typing RESTORE, takes a safety dump of the current database first, then restores and restarts the app. To restore uploads: `docker compose exec -T app tar -C /app/storage -xzf - < backups/daily/<stamp>/uploads.tar.gz`.
* After a complete loss of the VPS, set up a new VPS (5.1 → 5.2), copy the backup back from off-site with `rclone copy`, and run `restore.sh`.

## 5.5 Updating the application

```bash
cd /opt/rohan-construction && git pull
deploy/scripts/backup.sh                                       # always back up first
docker compose --env-file .env.production up -d --build        # migrate service runs automatically
```
