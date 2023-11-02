import express, { Request, Response, NextFunction } from 'express';
import passport from 'passport';

var router = express.Router();

/* GET users listing. */
router.get('/', function (req: Request, res: Response, next: NextFunction) {
    res.json([{
        id: 1,
        username: "samsepi0l"
    }, {
        id: 2,
        username: "D0loresH4ze"
    }]);
});

router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/error' }),
    function (req, res) {
        // Successful authentication, redirect success.
        res.redirect('/success');
    });

router.post("/login", passport.authenticate('local', {
    successRedirect: "/",
    failureRedirect: "/login",
}));

router.post("/logout", (req: Request, res: Response) => {
    req.logOut((err: any) => {
        if (err) {
            return console.log(err);
        }
        console.log(`-------> User Logged out`);
    });
    res.redirect("/login");
});

export default router;


