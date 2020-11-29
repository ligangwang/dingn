import 'package:flutter/material.dart';
import 'package:dingn/utils/custom_icons_icons.dart';
import 'package:provider/provider.dart' as provider;
import 'package:dingn/account/account_model.dart';

class GoogleLoginButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final accountModel = provider.Provider.of<AccountModel>(context);
    return OutlineButton(
      onPressed: () {
        accountModel.signInWithGoogle();
      },
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const <Widget>[
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
