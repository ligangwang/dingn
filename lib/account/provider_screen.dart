import 'dart:math';

import 'package:dingn/app/app_bar.dart';
import 'package:dingn/account/provider_model.dart';
import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class MainScreen extends StatelessWidget {
  const MainScreen({this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Scaffold(
      resizeToAvoidBottomInset: false,
      appBar: MyAppBar(),
      body: Column(
        children: <Widget>[
          Expanded(
            child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  //left panel
                  Container(
                    width: min(size.width, 800),
                    height: min(size.height, 600),
                    child: child,
                  ),
                  //right panel
                ]),
          ),
          const Padding(
              padding: EdgeInsets.all(50),
              child: Text(
                '© dingn 2020',
                style: TextStyle(
                    color: Colors.grey, fontSize: AppTheme.fontSizeFootnote),
              )),
        ],
      ),
    );
  }
}

class ProviderScreen<T extends ProviderModel> extends StatelessWidget {
  const ProviderScreen({this.modelBuilder, this.builder});
  final Widget Function(BuildContext context, T value, Widget child) builder;
  final T Function() modelBuilder;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<T>(
      builder: (context) => modelBuilder(),
      child: MainScreen(child: Consumer<T>(builder: builder)),
    );
  }
}
