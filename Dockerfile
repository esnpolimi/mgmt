FROM python:3.11-alpine
ENV PYTHONUNBUFFERED=1
RUN apk add --no-cache gcc musl-dev mariadb-dev # Install build dependencies
WORKDIR /app
COPY ./requirements.txt .
RUN pip install --no-cache-dir -r ./requirements.txt
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
ENTRYPOINT [ "python" ]
CMD ["manage.py","runserver","0.0.0.0:8000"]