FROM node:20-alpine as builder

# Create app directory
WORKDIR /usr/src/app

RUN apk update && apk add bash curl

RUN mkdir -p /usr/local/certs/ca-certificates
RUN curl -ks 'https://s3.amazonaws.com/rds-downloads/rds-ca-2015-root.pem' -o '/usr/local/certs/ca-certificates/rds-ca-2015-root.pem'

COPY . .

RUN yarn install

RUN yarn build

FROM node:20-alpine

# Add bash for debugging
RUN apk update && apk add bash

ENV NODE_ENV production

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

COPY --from=builder /usr/src/app/packages/backend/package.json /usr/src/app/package.json
COPY --from=builder /usr/src/app/packages/backend/build /usr/src/app
COPY --from=builder /usr/src/app/packages/backend/tsconfig.json /usr/src/app

COPY --from=builder /usr/src/app/packages/frontend/build /usr/src/app/public

COPY --from=builder /usr/local/certs/ca-certificates/rds-ca-2015-root.pem /usr/local/certs/ca-certificates/rds-ca-2015-root.pem

RUN yarn install --production

ENTRYPOINT [ "node", "index.js" ]
