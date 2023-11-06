FROM node:20-alpine as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

RUN yarn install

COPY . .

RUN yarn build

FROM node:20-alpine

ENV NODE_ENV production

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

COPY --from=builder /usr/src/app/packages/backend/package.json /usr/src/app/packages/backend/package.json
COPY --from=builder /usr/src/app/packages/backend/build ./packages/backend/build

COPY --from=builder /usr/src/app/packages/frontend/build ./packages/frontend/build

RUN yarn install --production
