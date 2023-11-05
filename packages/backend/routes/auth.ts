import express, { Request, Response, NextFunction } from 'express';
import passport from 'passport';

var router = express.Router();

router.get("/login/success", (req, res) => {
    if (req.user && req.isAuthenticated()) {
        res.status(200).json({
            success: true,
            message: "successful",
            user: req.user,
            //cookies: req.cookies
        });
    } else {
        res.status(401).json({
            success: false,
            message: "user not authenticated"
        })
    }
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/error' }),
    function (req, res) {
        // Successful authentication, redirect success.
        res.redirect('http://localhost:3000/');
    });

// router.post("/login", passport.authenticate('local', {
//     successRedirect: "/",
//     failureRedirect: "/login",
// }));

router.get("/logout", (req: Request, res: Response) => {
    req.logOut((err: any) => {
        if (err) {
            return console.log(err);
        }
        console.log(`-------> User Logged out`);
    });
    res.redirect("http://localhost:3000/login");
});

export default router;


