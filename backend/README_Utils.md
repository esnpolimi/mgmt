# Backend utils

## How to dump and restore the database (SQLite to MySQL)
From a sqlite environment
```bash
python manage.py dumpdata --exclude auth.permission --exclude contenttypes --output=data.json
```

Point to MySQL, convert data.json from AMSI to UTF8 (w/o BOM) and do:
```bash
python manage.py flush 
python manage.py migrate
python manage.py loaddata data.json 
```

## How to dump and restore the database with Docker (MySQL to MySQL)
After having found the docker container ID for mariadb (in this case 07a4261331d9),
```bash
cd backend
docker ps # List running containers to find the ID
docker exec 07a4261331d9 mysqldump -u user -ppassword newgest > db_backup.sql 
```

Now, to dump all and restore auth_permission and django_content_type:
```bash
docker compose -f local.yml exec backend python manage.py migrate
docker exec 07a4261331d9 mysqldump -u user -ppassword newgest auth_permission django_content_type > preserved_tables.sql
docker exec -it 07a4261331d9 mysql -u user -ppassword
DROP DATABASE newgest;
CREATE DATABASE newgest;
EXIT;
cd ..
docker compose -f local.yml exec backend python manage.py migrate
cd backend
# If in unix 
docker exec -i 07a4261331d9 mysql -u user -ppassword newgest < preserved_tables.sql
# If in powershell
Get-Content preserved_tables.sql | docker exec -i 07a4261331d9 mysql -u user -ppassword newgest 
```