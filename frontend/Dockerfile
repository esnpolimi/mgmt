FROM node:22.14-alpine
WORKDIR /app
COPY ./package*.json /app/
RUN npm ci --ignore-scripts
COPY . /app

CMD ["npm","run","dev"]