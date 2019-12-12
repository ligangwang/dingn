import 'package:dingn/models/account.dart';
import 'package:dingn/ui/pages/user_profile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dingn/blocs/bloc.dart';
import 'package:dingn/ui/widgets/error/error_widget.dart';
import 'package:dingn/ui/widgets/login/login_form.dart';
import 'package:dingn/ui/widgets/register/register_form.dart';

enum RegistrationState { login, register }

class AccountPage extends StatefulWidget {
  const AccountPage(this.returningPageState, this.userProfile);

  final PageState returningPageState;
  final Account userProfile;
  @override
  _AccountPageState createState() => _AccountPageState(returningPageState, userProfile);
}

class _AccountPageState extends State<AccountPage> {
  _AccountPageState(this.returningPageState, this.account);

  final PageState returningPageState;
  final Account account;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthenticationBloc, AuthenticationState>(
        builder: (context, state) {
      if (state is Unauthenticated) {
        return _SignInSignUp();
      }
      if (state is Authenticated) {
        if(returningPageState != null){
          BlocProvider.of<PageBloc>(context).add(NavigateToPageEvent(returningPageState));
        }
        return UserProfilePage(account: account);
      }
      return const CustomError(
        errorMessage: 'Auth not initialised',
      );
    });
  }
}

class _SignInSignUp extends StatefulWidget {
  @override
  __SignInSignUpState createState() => __SignInSignUpState();
}

class __SignInSignUpState extends State<_SignInSignUp> {
  RegistrationState _registrationState = RegistrationState.login;

  void _changeAccountStateToRegister() {
    setState(() {
      _registrationState = RegistrationState.register;
    });
  }

  void _changeAccountStateToLogin() {
    setState(() {
      _registrationState = RegistrationState.login;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 500),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: <Widget>[
            if (_registrationState == RegistrationState.login) LoginForm(),
            if (_registrationState == RegistrationState.register) RegisterForm(),
            if (_registrationState == RegistrationState.login)
              FlatButton(
                onPressed: _changeAccountStateToRegister,
                child: const Text("Don't have an account?"),
              ),
            if (_registrationState == RegistrationState.register)
              FlatButton(
                onPressed: _changeAccountStateToLogin,
                child: const Text('Back to login.'),
              ),
          ],
        ),
      ),
    );
  }
}
