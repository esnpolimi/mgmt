FROM python:3.12-alpine
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY ./requirements.txt .
RUN pip install -r ./requirements.txt
ENTRYPOINT [ "python" ]
CMD ["manage.py","runserver","0.0.0.0:8000"]