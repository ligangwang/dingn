import 'package:dingn/account/account_model.dart';
import 'package:dingn/account/google_login_button.dart';
import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:provider/provider.dart' as provider;

class SigninScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final accountModel = provider.Provider.of<AccountModel>(context);
    if (accountModel.isSignedIn) {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (context.mounted)
          Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
      });
    }
    return MainScreen(
        name: '/signin',
        child: Center(
            child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 440),
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: borderColor)),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const CircleAvatar(
                  radius: 32,
                  backgroundColor: alternateColor,
                  child: Icon(Icons.auto_awesome, color: accentColor)),
              const SizedBox(height: 24),
              const Text('A little practice starts here.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -.8)),
              const SizedBox(height: 12),
              const Text(
                  'Sign in to explore words, numbers, and playing cards with dingn.',
                  textAlign: TextAlign.center,
                  style:
                      TextStyle(color: mutedColor, fontSize: 14, height: 1.7)),
              const SizedBox(height: 28),
              GoogleLoginButton(),
            ]),
          ),
        )));
  }
}
