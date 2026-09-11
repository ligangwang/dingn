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
  Widget build(BuildContext context) => Scaffold(
        appBar: MyAppBar(name),
        body: SafeArea(
            child: Column(children: [
          Expanded(
              child: Center(
                  child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: name == '/' ? 1120 : 800),
            child: SizedBox(
                width: double.infinity, height: double.infinity, child: child),
          ))),
          Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              child: Text('dingn · A little practice, every day.',
                  style: const TextStyle(color: mutedColor, fontSize: 11))),
        ])),
      );
}

class ProviderScreen<T extends ProviderModel> extends StatelessWidget {
  const ProviderScreen({this.name, this.modelBuilder, this.builder});
  final Widget Function(BuildContext context, T value, Widget? child)? builder;
  final T Function()? modelBuilder;
  final String? name;
  @override
  Widget build(BuildContext context) => provider.ChangeNotifierProvider<T>(
        create: (context) => modelBuilder!(),
        child: MainScreen(
            name: name, child: provider.Consumer<T>(builder: builder!)),
      );
}
