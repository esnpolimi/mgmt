import * as Sentry from "@sentry/react";

Sentry.init({
    dsn: "https://f7ee9b97bae2c35e767d8e156eb7b116@o4509581352828928.ingest.de.sentry.io/4509581461487696",
    sendDefaultPii: true,
    environment: "production",
    debug: true
});