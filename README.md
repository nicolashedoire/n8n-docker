# n8n on your Mac with Docker

Run n8n **2.39.8** locally with persistent storage, an English getting-started guide, and a ready-to-import workflow.

## Quick start

1. Open Docker Desktop.
2. Double-click **Start.command** (Start) in this folder.
3. Your browser opens **http://localhost:5678**.
4. On your first visit, create your local n8n owner account with your email address and a password. You do not need an n8n Cloud subscription for this example.
5. Follow **[Your first workflow](FIRST-WORKFLOW.md)**.

If macOS prevents launching the script by double-clicking, use Terminal:

```bash
cd ~/Desktop/n8n-docker
bash Start.command
```

If you cloned this repository elsewhere, change to your clone's directory instead.

## Files

- `compose.yaml`: n8n, persistent storage, and a readiness check.
- `Start.command` / `Stop.command`: start / stop launchers for macOS.
- `FIRST-WORKFLOW.md`: quick import and a step-by-step tutorial.
- `workflows/01-hello.json`: a sample with no external services or API keys.
- `.env.example`: optional configuration template.

## Useful commands

Run these from the project directory:

```bash
docker compose up -d --wait    # Start n8n
docker compose ps             # Check container status
docker compose logs --tail=80 # Read recent logs
docker compose stop           # Stop without deleting data
docker compose start          # Resume after stopping
```

The published port binds only to `127.0.0.1`, so this instance is accessible from your Mac. Webhooks called by Internet services need a publicly reachable HTTPS setup; this project is a local learning environment.

## Data and GitHub

Saved workflows, your account, service credentials, and the encryption key live in the Docker volume `n8n-desktop_n8n_data`. They survive container stops and recreation.

**Do not run `docker compose down -v`: the `-v` option deletes the volume and its data.** Resetting Docker Desktop can also delete volumes.

GitHub stores the configuration and sample workflow only. It is not a backup of your instance. To version your own workflows, export them as JSON from the editor and check for sensitive data, private URLs, tokens, and credential references before committing. Git ignores `.env` and `backups/`.

For a complete backup, including the encryption key, run the following commands in the same Terminal session:

```bash
mkdir -p backups
chmod 700 backups
docker compose stop n8n
(umask 077; docker compose run --rm --no-deps -T --entrypoint tar n8n -czf - -C /home/node/.n8n . > "backups/n8n-$(date +%Y%m%d-%H%M%S).tar.gz")
docker compose start n8n
```

Check that the backup command succeeds. If it fails, still run `docker compose start n8n` to bring the service back. Store backups in a private, backed-up location: they contain sensitive data. To restore, stop n8n, extract the archive into an empty volume mounted at `/home/node/.n8n`, preserving permissions, then start the same n8n version. Do not restore over an existing database.

## Change the port

Copy `.env.example` to `.env`, replace `5678` with another port such as `5679`, and run `Start.command` again. The launcher opens the configured port.

## Update n8n

The image is pinned by its SHA-256 digest to reproduce the tested version. Running `docker compose pull` alone does not upgrade it. To upgrade, back up the volume, review the official release notes, replace the image in `compose.yaml` with a specific stable version (`docker.n8n.io/n8nio/n8n:VERSION`), then run `docker compose pull` and `docker compose up -d --wait`. Database migrations may prevent downgrading without restoring a backup.

## Troubleshooting

- **Cannot connect to Docker:** open Docker Desktop and wait until it is ready.
- **Port already in use:** change the port in `.env` as described above.
- **Page unavailable:** check `docker compose ps` and the logs; the first start applies database migrations.
- **Account setup requested:** complete the initial owner account setup.
- **Workflow missing after cloning:** import the JSON file. Instance workflows do not automatically sync with GitHub.
- **Scheduled execution stops:** your Mac must stay on and awake, with Docker running.

## References

- [Official Docker Compose documentation](https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/host-n8n/install-options/install-using-docker-compose.md)
- [Official n8n documentation](https://docs.n8n.io/)
- [Releases and release notes](https://github.com/n8n-io/n8n/releases)

This project uses the official n8n image. n8n remains subject to its publisher's license terms.
