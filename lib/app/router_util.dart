import 'package:dingn/account/account_screen.dart';
import 'package:dingn/account/signin_screen.dart';
import 'package:dingn/account/account_model.dart';
import 'package:dingn/home/home_screen.dart';
import 'package:dingn/number/number_screen.dart';
import 'package:dingn/playing_card/playing_card_screen.dart';
import 'package:dingn/word/word_screen.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;

class RouterUtil {
  static Route<dynamic> generateRoute(
      BuildContext context, RouteSettings settings) {
    final accountModel =
        provider.Provider.of<AccountModel>(context, listen: false);
    var route = settings.name;
    if (route != '/signin' && route != '/' && !accountModel.isSignedIn) {
      route = '/signin';
    }
    switch (route) {
      case '/':
        return MaterialPageRoute(builder: (_) => HomeScreen());
      case '/signin':
        return MaterialPageRoute(builder: (_) => SigninScreen());
      case '/account':
        return MaterialPageRoute(builder: (_) => AccountScreen());
      case '/word':
        return MaterialPageRoute(builder: (_) => WordScreen());
      case '/number':
        return MaterialPageRoute(builder: (_) => NumberScreen());
      case '/card':
        return MaterialPageRoute(builder: (_) => PlayingCardScreen());
      default:
        return MaterialPageRoute(builder: (_) {
          return Scaffold(
            body: Center(
              child: Text('No route defined for ${settings.name}'),
            ),
          );
        });
    }
  }
}
