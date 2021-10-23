import 'package:dingn/app/router_util.dart';
import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';

class MyApp extends StatelessWidget {
  const MyApp(this.title);
  final String title;
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'dingn - mind improvement',
      theme: AppTheme.theme(),
      debugShowCheckedModeBanner: false,
      initialRoute: '/',
      onGenerateRoute: (settings) => generateRoute(context, settings),
    );
  }
}
