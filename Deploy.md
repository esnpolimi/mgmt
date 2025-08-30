# Deploy your backend and frontend applications

## Backend Deployment

```bash
# Commit and push to development, then:
git subtree push --prefix backend origin deploy-backend
```

## Frontend Deployment

```bash
cd frontend
npm run build
cd ..
git add -f frontend/build
# Commit and push to development, then:
git subtree push --prefix frontend/build origin deploy-frontend
```

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

# Collect static files
python manage.py collectstatic --noinput
```

Lastly, restart the backend service from the cPanel Python WEB APPLICATIONS console
