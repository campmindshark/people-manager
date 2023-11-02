import express, { Express, Request, Response, Application, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import createError from 'http-errors';
import path from 'path';
import dotenv from 'dotenv';

import indexRouter from './routes/index';
import usersRouter from './routes/users';

//For env File 
dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3001;

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

app.listen(port, () => {
    console.log(`Server is Fire at http://localhost:${port}`);
});