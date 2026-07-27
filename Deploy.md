# Deploy your backend and frontend applications

## Automatic Deploy (GitHub Actions -> cPanel)

The production workflow in `.github/workflows/deploy-production.yml` now performs the full release flow automatically:

1. creates release tag on `main`
2. pushes backend subtree to `deploy-backend`
3. builds frontend and pushes `frontend/build` to `deploy-frontend`
4. creates GitHub release
5. connects to cPanel via SSH and runs:
	- `./gitpull_backend.sh`
	- `./gitpull_frontend.sh`
	- backend post-deploy commands (`pip install`, `migrate`, `collectstatic`, `check`)

Configure these repository secrets in GitHub (`Settings -> Secrets and variables -> Actions`):

- `CPANEL_HOST`
- `CPANEL_USERNAME`
- `CPANEL_SSH_KEY` (private key used for SSH login)
- `CPANEL_SSH_PORT` (optional, defaults to `22`)
- `CPANEL_PYTHON_APP_ROOT` (optional, defaults to `/home/fazucrdl/mgmt.esnpolimi.it/backend`)

If one of the required SSH secrets is missing, the cPanel deploy step is skipped.

## Frontend Deployment

```bash
cd frontend
npm run build
cd ..
git add -f frontend/build
# Commit and push to development, then:
git subtree push --prefix frontend/build origin deploy-frontend
```

## Backend Deployment

```bash
# Commit and push to development, then:
git subtree push --prefix backend origin deploy-backend
```

## Scheduled Jobs

Add this cron entry to generate treasury reports daily at 23:50 (Europe/Rome):

```bash
50 23 * * * /home/fazucrdl/virtualenv/mgmt.esnpolimi.it/3.11/bin/python /home/fazucrdl/mgmt.esnpolimi.it/backend/manage.py generate_treasury_reports
```

If the server timezone is not Europe/Rome, adjust the cron time accordingly.

## Notes

After having updated the deploy-xxxxxend branch, access to the server's console and execute the script:

```bash
cd mgmt.esnpolimi.it
./gitpull_xxxxxend.sh

# Eventually, reinstall django dependencies
source /home/fazucrdl/virtualenv/mgmt.esnpolimi.it/3.11/bin/activate && cd /home/fazucrdl/mgmt.esnpolimi.it/backend
pip install -r requirements.txt

# Eventually, make and apply migrations (if models have changed)
python manage.py makemigrations
python manage.py migrate
# if the tables have already been updated to the latest models' states, you can use the --fake option to mark the migrations as applied without actually running them, e.g.:
# python manage.py migrate --fake    

# remember to restart the Python App fron cpanel's pane in case of migrations to apply! 

# Collect static files
python manage.py collectstatic --noinput

python manage.py check
```

Lastly, restart the backend service from the cPanel Python WEB APPLICATIONS console

### Script names expected by CI

The automatic job expects these executable scripts in `/home/fazucrdl/mgmt.esnpolimi.it`:

- `gitpull_backend.sh`
- `gitpull_frontend.sh`

If your current script names are different, either rename them or update the workflow script accordingly.

### Automatic migrations and Python app restart

The workflow already runs:

- `python manage.py makemigrations --noinput`
- `python manage.py migrate --noinput`

`makemigrations` generates migrations on server if model changes are detected; `migrate` then applies pending migrations.

After backend checks, the workflow restarts the cPanel Python app by touching:

- `$CPANEL_PYTHON_APP_ROOT/tmp/restart.txt`

If your app root differs from the default path, set `CPANEL_PYTHON_APP_ROOT` in GitHub secrets.
