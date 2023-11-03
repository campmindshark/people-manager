# People Manager

An app for managing the people.

## General Repo Information
This section describes some of the general things you should know about this repo.

### Yarn Workspaces
This repo is powered by [yarn workspaces](https://classic.yarnpkg.com/lang/en/docs/workspaces/). By leveraging this technology we are able to cleanly layout the parts of the application. While also maintaining the ability to share code between them.

The ability to share models greatly helps in the typescript space. Without this we would have to maintain duplicate copies of the primary models we work with (ie. `User`).

### Backend
The backend is an express typescript app. It utilizes [knex](https://knexjs.org/) as its DB interaction Layer. In development/locally it uses a sqlite3 DB. In production it will use a postgresql DB.

## Getting Started

```
# Install dependencies
yarn

# Do migrations
yarn db-migrate

# Run locally
yarn dev
```
