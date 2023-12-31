import express, {
  Express, // eslint-disable-line
  Request,
  Response,
  Application,
  NextFunction,
} from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import logger from 'morgan';
import createError from 'http-errors';
import FileSystem from 'fs';
import path from 'path';
import Knex from 'knex';
import { Model } from 'objection';
import dotenv from 'dotenv';
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import knexConfig from './knexfile';
import { Config, getConfig } from './config/config';

import AppUser from './models/user/user';
import authRouter from './routes/auth';
import indexRouter from './routes/index';
import usersRouter from './routes/users';
import schedulesRouter from './routes/schedules';
import shiftsRouter from './routes/shifts';
import rolesRouter from './routes/roles';
import rostersRouter from './routes/rosters';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface,@typescript-eslint/no-namespace
    interface User extends AppUser {}
  }
}

const envFilePath = process.argv[2];

console.log('envFilePath: ', envFilePath);

const configPath = path.join(envFilePath);
if (!FileSystem.existsSync(configPath)) {
  console.log(`Config file not found at ${configPath}`);
}

// For env File
dotenv.config({ path: configPath });
const config: Config = getConfig();

console.log(`running in ${config.Environment} mode`);

// Initialize knex.
const knex = Knex(knexConfig[config.Environment]);
Model.knex(knex);

const app: Application = express();

app.use(
  cors({
    origin: config.CORSWhitelist,
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    credentials: true,
  }),
);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: config.JWTSecret,
    resave: false,
    saveUninitialized: true,
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
app.use('/api/users', checkAuthenticated, usersRouter);
app.use('/api/roles', checkAuthenticated, rolesRouter);
app.use('/api/schedules', checkAuthenticated, schedulesRouter);
app.use('/api/shifts', checkAuthenticated, shiftsRouter);
app.use('/api/rosters', checkAuthenticated, rostersRouter);

app.use('/', indexRouter); // this route should be last

// catch 404 and forward to error handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createError(404));
});

app.listen(config.Port, () => {
  console.log(`Server is running at http://localhost:${config.Port}`);
});
