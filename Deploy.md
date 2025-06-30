# Deploy your backend and frontend applications

## Backend Deployment

```bash
# Commit and push to development
git subtree push --prefix backend origin deploy-backend
```

## Frontend Deployment

```bash
cd frontend
npm run build
cd ..
git add -f frontend/build
# Commit and push to development
git subtree push --prefix frontend/build origin deploy-frontend
```

## Notes

After having updated the deploy-xxxxxend branch, access to the server's console and execute the script:
```bash
cd mgmt.esnpolimi.it
./gitpull_xxxxxend.sh
```
