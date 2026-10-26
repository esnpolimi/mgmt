FROM node:22.14-alpine
WORKDIR /app
COPY --chown=node:node ./package*.json /app/
USER node
RUN npm ci --ignore-scripts
COPY --chown=node:node ./src ./src
COPY --chown=node:node ./public ./public
COPY --chown=node:node ./index.html ./vite.config.mjs ./

CMD ["npm","run","dev"]