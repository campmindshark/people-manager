FROM node:20-alpine as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

ENV NODE_ENV development

RUN yarn install

COPY . .

RUN yarn build

FROM node:20-alpine

ENV NODE_ENV production

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

COPY --from=builder /usr/src/app/packages/backend/package.json /usr/src/app/package.json
COPY --from=builder /usr/src/app/packages/backend/build /usr/src/app
COPY --from=builder /usr/src/app/packages/backend/tsconfig.json /usr/src/app

COPY --from=builder /usr/src/app/packages/frontend/build /usr/src/app/public

RUN yarn install --production

ENTRYPOINT [ "node", "index.js" ]
