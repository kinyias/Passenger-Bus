const controller = {} //Để {} vì là object có thể chứa thêm các hàm khác
let models = require('../models')
let User = models.TaiKhoan;
let bcrypt = require('bcryptjs');
let jwt = require('jsonwebtoken')
const SECRET_KEY = "qwertyuiopasdfghjkl";
const Mailjet = require('node-mailjet');
const mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC || '8c1ec4ae629a793fc6de402c4cec9748',
    process.env.MJ_APIKEY_PRIVATE || '891875623af5ec6e57624095a379e8d5',
);

controller.showFormLogin = (req, res) => {  //Hiển thị form đăng nhập
    req.session.returnURL = req.query.returnURL;
    res.render('login');
}

controller.showFormRegister = (req, res) => { //Hiển thị form đăng ký
    req.session.returnURL = req.query.returnURL;
    res.render('register');
}

controller.login = (req, res, next) => { //Xử lý khi người dùng đăng nhập
    let email = req.body.email
    let password = req.body.password

    controller
        .getUserByEmail(email)
        .then(user => {
            if (user) {
                //Kiểm tra xem mật khẩu nhập có đúng không và đã xác thực tài khoản chưa
                if (controller.comparePassword(password, user.password) == true && user.isVerified == true) {
                    req.session.user = user;
                    if (req.session.returnURL) {
                        return res.redirect(req.session.returnURL)
                    } else {
                        return res.redirect('/')
                    }
                }
                else if (controller.comparePassword(password, user.password) == true && user.isVerified == false) {
                    return res.render('login', {
                        message: 'Tài khoản của bạn chưa được xác thực trong hệ thống, vui lòng xác thực!',
                        type: 'alert-danger'
                    })
                }
                else {
                    return res.render('login', {
                        message: 'Mật khẩu nhập không đúng!!!',
                        type: 'alert-danger'
                    })
                }
            }
            return res.render('login', {
                message: 'Email không tồn tại!!!',
                type: 'alert-danger'
            })
        })
}

controller.logout = (req, res, next) => { //Đăng xuất
    req.session.destroy(error => { //Hủy session id
        if (error) {
            return next(error);
        }
        return res.redirect('/')
    })
}

controller.getUserByEmail = (email) => {
    return User.findOne({
        where: {
            email: email
        }
    })
}

controller.createUser = (user) => { //Tạo tài khoản người dùng và mã hóa mật khẩu
    var salt = bcrypt.genSaltSync(10);
    user.password = bcrypt.hashSync(user.password, salt);
    return User.create(user);
}

controller.register = (req, res, next) => { //Xử lý đăng ký tài khoản
    let fullname = req.body.fullname
    let email = req.body.email
    let password = req.body.password
    let confirmPassword = req.body.confirmPassword;

    //Kiểm tra confirm password và password giống nhau
    if (password != confirmPassword) {
        return res.render('register', {
            message: 'Xác nhận mật khẩu không trùng với mật khẩu đã nhập',
            type: 'alert-danger'
        })
    }
    //Kiểm tra username chưa tồn tại
    controller
        .getUserByEmail(email)
        .then(user => {
            if (user) { //Nếu tìm được người dùng trong hệ thống
                return res.render('register', {
                    message: `Email ${email} đã tồn tại, vui lòng nhập email khác để đăng ký!!!`,
                    type: 'alert-danger'
                })
            }
            user = {
                fullName: fullname,
                email,
                password,
                imageAccount: '/images/default.jpg',
                isVerified: false,
                isAdmin: false
            }
            //Tạo link
            let token = controller.createJWTVerifyAccount(email);
            let host = req.header('host');
            let url = `${req.protocol}://${host}/users/verify?u=${email}&t=${token}`;
            //Gửi email
            controller.sendVerifyUserEmail(user, host, url)

            return controller
                .createUser(user)
                .then(user => {
                    //req.session.user = user;
                    if (req.session.returnURL) { //Kiểm tra người dùng đã từng truy xuất url trước đó không
                        return res.redirect(req.session.returnURL)
                    } else {
                        return res.render('register', {
                            message: 'Chúng tôi đã gửi tới email của bạn 1 liên kết xác thực tài khoản, vui lòng kiểm tra để xác thực tài khoản!!',
                            type: 'alert-success',
                        }
                        )
                    }
                })

        })
}

controller.comparePassword = (password, hash) => { //Kiểm tra mật khẩu với hash 
    return bcrypt.compareSync(password, hash);
}

controller.isLoggedIn = (req, res, next) => { //Kiểm tra xem đã đăng nhập hay chưa
    if (req.session.user) {
        next();
    } else {
        res.redirect(`/users/login?returnURL=${req.originalUrl}`)
    }
}

controller.createJWTResetPassword = (email) => {  //Tạo jsontoken reset password về email
    return jwt.sign({
        email
    },
        SECRET_KEY,
        {
            expiresIn: "1h"
        }
    )
}

controller.createJWTVerifyAccount = (email) => { //Tạo jsontoken xác nhận tài khoản
    return jwt.sign({
        email
    },
        SECRET_KEY,
    )
}

controller.verifyJWT = (token) => { //Xác thực jsontoken
    try {
        jwt.verify(token, SECRET_KEY);
        return true;
    } catch (error) {
        return false;
    }
}

controller.sendResetPasswordMail = (user, host, url) => { //Gửi reset password email
    const request = mailjet
        .post('send', { version: 'v3.1' })
        .request({
            Messages: [
                {
                    From: {
                        Email: "kidkhangff@gmail.com",
                        Name: "PassengerBus"
                    },
                    To: [
                        {
                            Email: user.email,
                            Name: user.fullName
                        }
                    ],
                    Subject: "Reset Password",
                    //   TextPart: "Dear passenger 1, welcome to Mailjet! May the delivery force be with you!",
                    HTMLPart: `
              <p>Hi ${user.fullName}</p>,
              
              <p>You recently requested to reset the password for your ${host} account. 
              Click the link below to proceed.</p>
              <br/>
              <p><a href="${url}   ">Reset password</a></p>
              <br/>
              <p>If you did not request a password reset, please ignore this email or reply to let us know. This password reset link is only valid for the next 30 minutes.</p>
              <br/>
              <p>Thanks,</p>
              <p> PassengerBus</p>`
                }
            ]
        })
    return request;
}

controller.sendVerifyUserEmail = (user, host, url) => {  //Gửi xác thực tài khoản email
    const request = mailjet
        .post('send', { version: 'v3.1' })
        .request({
            Messages: [
                {
                    From: {
                        Email: "kidkhangff@gmail.com",
                        Name: "PassengerBus"
                    },
                    To: [
                        {
                            Email: user.email,
                            Name: user.fullName
                        }
                    ],
                    Subject: "Verify account",
                    //   TextPart: "Dear passenger 1, welcome to Mailjet! May the delivery force be with you!",
                    HTMLPart: `
                    <p>Hi ${user.fullName},</p>
                    <br/>
                    <p>We just need to verify your email address before you can access ${host}.</p>
                    <br/>
                    <p>Verify your email address <a href="${url}">Click here</a></p>
                    <br/>
                    <p>Thanks!,</p>
                    <p>The PassengerBus team</p>`
                }
            ]
        })
    return request;
}

//Gửi đặt vé email
controller.sendEmailTicketOrder = (user, trip, tripCompName, numOfSeats, totalPrice, host, url) => {
    const request = mailjet
        .post('send', { version: 'v3.1' })
        .request({
            Messages: [
                {
                    From: {
                        Email: "kidkhangff@gmail.com",
                        Name: "PassengerBus"
                    },
                    To: [
                        {
                            Email: user.email,
                            Name: user.fullName
                        }
                    ],
                    Subject: "Successful booking",
                    //   TextPart: "Dear passenger 1, welcome to Mailjet! May the delivery force be with you!",
                    HTMLPart: `
                    <p> Hi ${user.fullName}, </p>
                    <br/>
                    <p> Woo hoo! Congratulations on your successful booking. </p>
                    <br/>
                    <p> ORDER TICKET SUMMARY: </p>
                    <ul>
                        <li> Name of the trip: ${trip.startProvince} -> ${trip.endProvince}</li>
                        <li> Trip company name: ${tripCompName}</li>
                        <li> Number of seats: ${numOfSeats}</li>
                        <li> Departure day: ${trip.startDate}</li>
                        <li> Total Price: ${totalPrice}</li>
                    </ul>
                    <br/>
                    <p> Thanks,</p>
                    <p> PassengerBus team</p>
                    `
                }
            ]
        })
    return request;
}

//Cập nhật mật khẩu
controller.updatePassword = (user) => {
    var salt = bcrypt.genSaltSync(10);
    user.password = bcrypt.hashSync(user.password, salt);
    return User.update({
        password: user.password
    }, {
        where: {
            id: user.id
        }
    });
}

controller.resetPasswordSendEmail = (req, res, next) => {
    let email = req.body.email;

    controller.getUserByEmail(email)
        .then(user => {
            if (user) {
                //Tạo link
                let token = controller.createJWTResetPassword(email);
                let host = req.header('host');
                let url = `${req.protocol}://${host}/users/reset?u=${email}&t=${token}`;
                //Gửi email
                controller.sendResetPasswordMail(user, host, url)
                    .then((result) => {
                        return res.render('forgotPassword', {
                            done: 1,
                            email
                        })
                    })
                    .catch((err) => {
                        return res.render('forgotPassword', {
                            email,
                            message: 'Có lỗi xảy ra khi gửi tới email của bạn!!! Hãy thử lại lần kế tiếp',
                            type: 'alert-danger'
                        })
                    })
            } else {
                return res.render('forgotPassword', {
                    message: 'Email này chưa đăng ký ở trong hệ thống. Hãy thử email khác hoặc <a href="/users/register">đăng ký.</a>',
                    type: 'alert-danger',
                    email
                })
            }

        }
        ).catch(error => next(error))
}

controller.getLinkResetPassword = (req, res, next) => {
    let email = req.query.u;
    let token = req.query.t;

    if (!email || !token) {
        return res.redirect('/users/reset-password');
    }
    let isVerify = controller.verifyJWT(token);
    if (isVerify) {
        return res.render('resetPassword', {
            email,
            message: 'Vui lòng nhập mật khẩu mới của bạn'
        });
    } else {
        return res.render('forgotPassword', {
            message: 'Liên kết reset đã quá hạn. Vui lòng nhập lại địa chỉ email',
        })
    }
}

controller.resetPasswordAccount = (req, res, next) => {
    let email = req.body.email;
    let password = req.body.password;
    let confirmPassword = req.body.confirmPassword;

    if (password != confirmPassword) {
        return res.render('resetPassword', {
            email,
            message: 'Xác nhận mật khẩu không trùng với mật khẩu đã nhập',
            type: 'alert-danger'
        })
    }
    controller.getUserByEmail(email)
        .then(user => {
            if (user) {
                user.password = password;
                controller.updatePassword(user);
                return res.render('resetPassword', {
                    done: 1
                })
            } else {
                return res.redirect('/users/reset-password')
            }
        })
}

controller.verifyUserByLink = (req, res, next) => {
    let email = req.query.u;
    let token = req.query.t;

    if (!email || !token) {
        return res.redirect('/users/login');
    }
    let isVerify = controller.verifyJWT(token);
    if (isVerify) {
        controller
            .getUserByEmail(email)
            .then(user => {
                if (user) {
                    User.update({
                        isVerified: true
                    }, {
                        where: {
                            email: user.email
                        }
                    })

                    return res.render('verifyUser', {
                        email,
                    });
                } else {
                    return res.render('login', {
                        message: 'Không tìm thấy email trong hệ thống!!!'
                    })
                }
            })


    } else {
        return res.render('login', {
            message: 'Liên kết xác nhận tài khoản đã quá hạn. Vui lòng đăng ký lại',
        })
    }
}

module.exports = controller;