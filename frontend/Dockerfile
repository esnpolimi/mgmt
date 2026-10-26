FROM node:22.14-alpine
WORKDIR /app
COPY --chown=node:node ./package*.json /app/
USER node
RUN npm ci --ignore-scripts
COPY --chown=node:node . /app

CMD ["npm","run","dev"]