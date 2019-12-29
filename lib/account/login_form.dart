import 'package:dingn/account/account_model.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'google_login_button.dart';
import 'login_button.dart';

class LoginForm extends StatefulWidget {
  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  FocusNode _emailFocus;
  FocusNode _passwordFocus;

  bool get isPopulated =>
      _emailController.text.isNotEmpty && _passwordController.text.isNotEmpty;

  bool isLoginButtonEnabled(AccountModel state) {
    return state.isFormValid && isPopulated && !state.isSubmitting;
  }

  @override
  void initState() {
    super.initState();
    _emailFocus = FocusNode();
    _passwordFocus = FocusNode();
    _emailController.addListener(_onEmailChanged);
    _passwordController.addListener(_onPasswordChanged);
  }

  @override
  Widget build(BuildContext context) {
    final accountModel = Provider.of<AccountModel>(context);
    return Padding(
      padding: const EdgeInsets.all(20.0),
      child: Form(
        child: Column(
          children: <Widget>[
            RawKeyboardListener(
              focusNode: _emailFocus,
              onKey: (dynamic key) {
                if (key.data.keyCode == 9) {
                  FocusScope.of(context).requestFocus(_passwordFocus);
                }
              },
              child: TextFormField(
                controller: _emailController,
                decoration: InputDecoration(
                  icon: Icon(Icons.email),
                  labelText: 'Email',
                ),
                autovalidate: true,
                autocorrect: false,
                validator: (_) {
                  return !accountModel.isEmailValid ? 'Invalid Email' : null;
                },
              ),
            ),
            TextFormField(
              focusNode: _passwordFocus,
              controller: _passwordController,
              decoration: InputDecoration(
                icon: Icon(Icons.lock),
                labelText: 'Password',
              ),
              obscureText: true,
              autovalidate: true,
              autocorrect: false,
              validator: (_) {
                return !accountModel.isPasswordValid ? 'Invalid Password' : null;
              },
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  LoginButton(
                    onPressed: isLoginButtonEnabled(accountModel)
                        ? _onFormSubmitted
                        : null,
                  ),
                  GoogleLoginButton(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
        
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  void _onEmailChanged() {
    // _loginBloc.add(
    //   EmailChanged(email: _emailController.text),
    // );
  }

  void _onPasswordChanged() {
    // _loginBloc.add(
    //   PasswordChanged(password: _passwordController.text),
    // );
  }

  void _onFormSubmitted() {
    // _loginBloc.add(
    //   LoginWithCredentialsPressed(
    //     email: _emailController.text,
    //     password: _passwordController.text,
    //   ),
    // );
  }
}