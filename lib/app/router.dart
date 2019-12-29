import 'package:dingn/account/account_screen.dart';
import 'package:dingn/account/signin_screen.dart';
import 'package:dingn/home/home_screen.dart';
import 'package:dingn/number/number_screen.dart';
import 'package:dingn/word/word_screen.dart';
import 'package:flutter/material.dart';
  
class Router {
  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
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