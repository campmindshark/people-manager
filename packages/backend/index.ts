import express, { Express, Request, Response, Application, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import logger from 'morgan';
import createError from 'http-errors';
import path from 'path';
import Knex from 'knex';
import knexConfig from './knexfile'
import { Model, ForeignKeyViolationError, ValidationError } from 'objection'
import dotenv from 'dotenv';
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import User from './user/user';
import authRouter from './routes/auth';
import indexRouter from './routes/index';
import usersRouter from './routes/users';

//For env File 
dotenv.config({ path: __dirname + '/.env.local' });

// Initialize knex.
const knex = Knex(knexConfig.development)
Model.knex(knex)

const app: Application = express();
const port = process.env.PORT || 3001;

app.use(
    cors({
        origin: "http://localhost:3000",
        methods: "GET,POST,PUT,DELETE,OPTIONS",
        credentials: true,
    })
);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'yerrrrr',
    resave: false,
    saveUninitialized: true,
}))

// configure passport
app.use(passport.initialize())
app.use(passport.session())

passport.serializeUser(function (user, cb) {
    cb(null, user);
});

passport.deserializeUser(function (user: any, cb) {
    cb(null, user);
});

/*  Google AUTH  */
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
    callbackURL: "http://localhost:3001/auth/google/callback"
},
    async function (accessToken, refreshToken, profile, done) {
        const query = User.query();
        query.where('googleID', profile.id);
        const user = await query;
        if (user.length === 0) {
            const newUserModel = new User();
            newUserModel.googleID = profile.id ?? '';
            newUserModel.firstName = profile.name?.givenName ?? '';
            newUserModel.lastName = profile.name?.familyName ?? '';

            const query = await User.query().insert(newUserModel);
            const newUser = await query;
            console.log(newUser);
            return done(null, newUser);
        }

        console.log(profile);
        return done(null, profile);
    }
));

// Add this middleware BELOW passport middleware
app.use(function (req, res, next) {
    res.locals.user = req.user;
    next();
});

const checkAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) { return next() }
    res.redirect("/login")
}

app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/users', usersRouter);


// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
    next(createError(404));
});

app.listen(port, () => {
    console.log(`Server is Fire at http://localhost:${port}`);
});