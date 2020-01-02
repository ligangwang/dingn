import 'package:dingn/account/account_model.dart';
import 'package:dingn/account/google_login_button.dart';
import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_login/flutter_login.dart';
import 'package:provider/provider.dart';


class SigninScreen extends StatelessWidget {
  Future<String> _signinUser(BuildContext context, LoginData data) async {
    final accountModel = Provider.of<AccountModel>(context);
    final account = await accountModel.signInWithCredentials(email:data.name, password:data.password);
    return account == null ? 'Email and password does not match' : null;
  }

  Future<String> _signupUser(BuildContext context, LoginData data) async {
    final accountModel = Provider.of<AccountModel>(context);
    final account = await accountModel.signUp(email:data.name, password:data.password);
    return account == null ? 'Sorry signup failed.' : null;
  }

  Future<String> _recoverPassword(BuildContext context, String email) async {
    final accountModel = Provider.of<AccountModel>(context);
    await accountModel.sendPasswordResetEmail(email);
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final accountModel = Provider.of<AccountModel>(context);
    if (accountModel.isSignedIn){
      SchedulerBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).pushNamedAndRemoveUntil('/', (Route<dynamic> route) => false);
      });    
    }
    return FlutterLogin(
      title: '',
      theme: LoginTheme(
        primaryColor: Colors.white,
        accentColor: AppTheme.accentColor,
        buttonTheme: LoginButtonTheme(backgroundColor: AppTheme.accentColor)
      ),
      messages: LoginMessages(
        loginButton: 'sign in', 
        signupButton: 'sign up', 
        recoverPasswordIntro: 'Password Reset',
        recoverPasswordDescription: 'Please specify your email to send the password reset link.',
        recoverPasswordButton: 'send'),
      onLogin: (loginData)=>_signinUser(context, loginData),
      onSignup: (loginData)=>_signupUser(context, loginData),
      onSubmitAnimationCompleted: () {
        Navigator.of(context).pop();
      },
      onRecoverPassword: (email)=>_recoverPassword(context, email),
      extend: GoogleLoginButton(),
    );
  }
}