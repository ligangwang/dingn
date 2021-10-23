import 'package:dingn/account/account_model.dart';
import 'package:dingn/account/google_login_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:provider/provider.dart' as provider;

class SigninScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final accountModel = provider.Provider.of<AccountModel>(context);
    if (accountModel.isSignedIn) {
      SchedulerBinding.instance!.addPostFrameCallback((_) {
        Navigator.of(context)
            .pushNamedAndRemoveUntil('/', (Route<dynamic> route) => false);
      });
    }
    return GoogleLoginButton();
  }
}
