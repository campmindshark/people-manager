FROM node:20-alpine as builder

WORKDIR /usr/src/app

RUN apk add --no-cache bash curl

RUN mkdir -p /usr/local/certs/ca-certificates
RUN curl -fsSL 'https://truststore.pki.rds.amazonaws.com/us-west-2/us-west-2-bundle.pem' -o '/usr/local/certs/ca-certificates/us-west-2-bundle.pem'

# Copy only the manifests first so the install layer is cached as long as
# package.json and yarn.lock don't change. Source-only changes will reuse the
# install layer below.
COPY package.json yarn.lock ./
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

FROM node:20-alpine

RUN apk add --no-cache bash

ENV NODE_ENV production

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/packages/backend/package.json /usr/src/app/package.json
COPY --from=builder /usr/src/app/yarn.lock /usr/src/app/yarn.lock
COPY --from=builder /usr/src/app/packages/backend/build /usr/src/app
COPY --from=builder /usr/src/app/packages/backend/tsconfig.json /usr/src/app

COPY --from=builder /usr/src/app/packages/frontend/build /usr/src/app/public

COPY --from=builder /usr/local/certs/ca-certificates/us-west-2-bundle.pem /usr/local/certs/ca-certificates/us-west-2-bundle.pem

RUN yarn install --production

ENTRYPOINT [ "node", "index.js" ]
