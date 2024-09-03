FROM node:18.19.1-alpine
WORKDIR /app
COPY ./package.json /app/
RUN npm install
ENTRYPOINT [ "npm" ]
CMD ["start"]