import express, { Express, Request, Response, Application, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import logger from 'morgan';
import createError from 'http-errors';
import path from 'path';
import dotenv from 'dotenv';
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import authRouter from './routes/auth';
import indexRouter from './routes/index';
import usersRouter from './routes/users';

//For env File 
dotenv.config({ path: __dirname + '/.env.local' });

const app: Application = express();
const port = process.env.PORT || 3001;

app.use(
    cors({
        origin: ["http://localhost:3000"],
        methods: "GET,POST,PUT,DELETE,OPTIONS",
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
// configure passporyarn add t
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
    function (accessToken, refreshToken, profile, done) {
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
app.use('/', authRouter);
app.use('/users', usersRouter);


// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
    next(createError(404));
});

// error handler
// app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
//     // set locals, only providing error in development
//     res.locals.message = err.message;
//     res.locals.error = req.app.get('env') === 'development' ? err : {};

//     // render the error page
//     res.status(err.status || 500);
//     res.send();
//     // res.render('error');
// });

app.listen(port, () => {
    console.log(`Server is Fire at http://localhost:${port}`);
});