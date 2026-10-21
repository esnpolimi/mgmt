FROM node:22.14-alpine
WORKDIR /app
COPY ./package*.json /app/
RUN npm ci
COPY . /app

CMD ["npm","run","dev"]