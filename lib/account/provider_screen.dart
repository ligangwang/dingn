import 'dart:math';

import 'package:dingn/account/provider_model.dart';
import 'package:dingn/app/app_bar.dart';
import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;

class MainScreen extends StatelessWidget {
  const MainScreen({this.name, this.child});
  final Widget? child;
  final String? name;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Scaffold(
      resizeToAvoidBottomInset: false,
      appBar: MyAppBar(name),
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
              padding: EdgeInsets.all(10),
              child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    Text(
                      '© dingn 2021',
                      style: TextStyle(
                          color: Colors.grey, fontSize: fontSizeFootnote),
                    ),
                    SizedBox(width: 5),
                    Text('v1.2.13', //v1.2.11: upgrade to flutter 1.24.0
                        style: TextStyle(
                            color: Colors.grey, fontSize: fontSizeTiny)),
                  ])),
        ],
      ),
    );
  }
}

class ProviderScreen<T extends ProviderModel> extends StatelessWidget {
  const ProviderScreen({this.name, this.modelBuilder, this.builder});
  final Widget Function(BuildContext context, T value, Widget? child)? builder;
  final T Function()? modelBuilder;
  final String? name;

  @override
  Widget build(BuildContext context) {
    return provider.ChangeNotifierProvider<T>(
      create: (context) => modelBuilder!(),
      child: MainScreen(
          name: name, child: provider.Consumer<T>(builder: builder!)),
    );
  }
}
