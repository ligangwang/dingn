import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dingn/blocs/bloc.dart';
import 'package:dingn/ui/widgets/error/error_widget.dart';
import 'package:dingn/ui/widgets/login/login_form.dart';
import 'package:dingn/ui/widgets/register/register_form.dart';

enum RegistrationState { login, register }

class AccountPage extends StatefulWidget {
  const AccountPage(this.returningPageState);

  final PageState returningPageState;
  @override
  _AccountPageState createState() => _AccountPageState(returningPageState);
}

class _AccountPageState extends State<AccountPage> {
  _AccountPageState(this.returningPageState);

  final PageState returningPageState;

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
        return FlatButton(
          onPressed: () {
            BlocProvider.of<AuthenticationBloc>(context).signOut();//.add(LoggedOutEvent());
          },
          child: const Text('Sign out'),
        );
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
