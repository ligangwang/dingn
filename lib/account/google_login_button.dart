import 'package:dingn/account/account_model.dart';
import 'package:dingn/utils/custom_icons_icons.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;

class GoogleLoginButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final accountModel = provider.Provider.of<AccountModel>(context);
    return OutlinedButton(
      onPressed: () {
        accountModel.signInWithGoogle();
      },
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(CustomIcons.google),
          SizedBox(
            width: 8,
          ),
          Text('LOGIN WITH GOOGLE'),
        ],
      ),
    );
  }
}
