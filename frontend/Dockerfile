FROM node:22.14-slim
WORKDIR /app
COPY ./package*.json /app/
RUN npm install
COPY . /app

CMD ["npm","run","dev"]