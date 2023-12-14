# People Manager

An app for managing the people.

## General Repo Information

This section describes some of the general things you should know about this repo.

### Yarn Workspaces

This repo is powered by [yarn workspaces](https://classic.yarnpkg.com/lang/en/docs/workspaces/). By leveraging this technology we are able to cleanly layout the parts of the application. While also maintaining the ability to share code between them.

The ability to share models greatly helps in the typescript space. Without this we would have to maintain duplicate copies of the primary models we work with (ie. `User`).

### Backend

The backend is an express typescript app. It utilizes [knex](https://knexjs.org/) as its DB interaction Layer. In development/locally it uses a sqlite3 DB. In production it will use a postgresql DB.

## Getting Started With Development

1. Setup your env var file by copy pasting the contents of `packages/backend/env/.env.sample` into a new `packages/backend/env/.env.local` and filling it out with appropriate values.

2. Running the application:

```
# Install dependencies
yarn

# Do migrations
yarn db-migrate

# Seed DB with test data (optional, but convenient)
yarn db-seed

# Run locally
yarn dev
```

## Getting Started With Docker

1. generate the application image `make docker-build`
2. generate the migration image `make docker-migration-build`
3. make sure you have an appropriate `.env` file stored at `./packages/backend/env/.env.docker.local`
4. start the application with `docker-compose up`

## Design Stuff

The app is primarily powered by MaterialUI. Which is great for everyone that doesnt love doing a bunch of CSS.

I picked this color pallette to give us some additional colors to mess with https://coolors.co/palette/f94144-f3722c-f8961e-f9844a-f9c74f-90be6d-43aa8b-4d908e-577590-277da1.
