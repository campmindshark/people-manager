import express, {
  Express, // eslint-disable-line
  Request,
  Response,
  Application,
  NextFunction,
} from 'express';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import logger from 'morgan';
import createError from 'http-errors';
import FileSystem from 'fs';
import Knex from 'knex';
import { Model } from 'objection';
import dotenv from 'dotenv';
import passport from 'passport';
import session from 'express-session';
import genFunc from 'connect-pg-simple';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import knexConfig from './knexfile';
import { Config, getConfig } from './config/config';

import AppUser from './models/user/user';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import userPrivateRouter from './routes/user_private';
import schedulesRouter from './routes/schedules';
import shiftsRouter from './routes/shifts';
import rolesRouter from './routes/roles';
import rostersRouter from './routes/rosters';
import rosterParticipantsRouter from './routes/roster_participants';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface,@typescript-eslint/no-namespace
    interface User extends AppUser {}
  }
}

const envFilePath = process.argv[2];

console.log(`Starting people-manager backend with env file: ${envFilePath}`);

if (!FileSystem.existsSync(envFilePath)) {
  console.log(`env file not found at ${envFilePath}`);
} else {
  console.log(`env file found at ${envFilePath}`);
  dotenv.config({ path: envFilePath });
}

const config: Config = getConfig();

console.log(`running in ${config.Environment} mode`);

// Initialize knex.
const knex = Knex(knexConfig[config.Environment]);
Model.knex(knex);

const app: Application = express();

console.log('CORS Whitelist:', config.CORSWhitelist);
app.use(
  cors({
    origin: config.CORSWhitelist,
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', config.CORSWhitelist.join(', ')); // update to match the domain you will make the request from
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept',
  );
  next();
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

console.log('using postgres session store');
const PostgresqlStore = genFunc(session);
const sessionStore = new PostgresqlStore({
  conString: config.PostgresConnectionURL,
  conObject: {
    connectionString: config.PostgresConnectionURL,
    ssl:
      config.Environment === 'production'
        ? {
            cert: fs.readFileSync(config.PostgresSSLCertPath).toString(),
          }
        : false,
  },
});

app.use(
  session({
    secret: config.JWTSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    store: sessionStore,
  }),
);

// configure passport
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user: never, cb) => {
  cb(null, user);
});

/*  Google AUTH  */
passport.use(
  new GoogleStrategy(
    {
      clientID: config.GoogleOAuthClientID,
      clientSecret: config.GoogleOAuthClientSecret,
      callbackURL: config.GoogleOAuthCallbackURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      const query = AppUser.query();
      query.where('googleID', profile.id);
      const user = await query;
      if (user.length === 0) {
        const newUserModel = new AppUser();
        newUserModel.googleID = profile.id ?? '';
        newUserModel.firstName = profile.name?.givenName ?? '';
        newUserModel.lastName = profile.name?.familyName ?? '';
        newUserModel.email = profile.emails?.[0].value ?? '';

        const innerQuery = AppUser.query().insert(newUserModel);
        const newUser = await innerQuery;
        return done(null, newUser);
      }

      if (user.length > 1) {
        return done(
          new Error('More than one user with the same Google ID was found'),
        );
      }

      return done(null, user[0]);
    },
  ),
);

// Add this middleware BELOW passport middleware
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

const checkAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
  // eslint-disable-next-line consistent-return
) => {
  if (req.isAuthenticated() && req.user.googleID !== '') {
    return next();
  }
  next(createError(401));
};

app.use('/api/auth', authRouter);
app.use('/api/users/private', checkAuthenticated, userPrivateRouter);
app.use('/api/users', checkAuthenticated, usersRouter);
app.use('/api/roles', checkAuthenticated, rolesRouter);
app.use('/api/schedules', checkAuthenticated, schedulesRouter);
app.use('/api/shifts', checkAuthenticated, shiftsRouter);
app.use('/api/rosters', checkAuthenticated, rostersRouter);
app.use(
  '/api/roster_participants',
  checkAuthenticated,
  rosterParticipantsRouter,
);

app.use('/api/health', (req: Request, res: Response) => {
  res.status(200).send('healthy');
});

// catch 404 and forward to error handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createError(404));
});

app.listen(config.Port, () => {
  console.log(`Server is running at http://localhost:${config.Port}`);
});
