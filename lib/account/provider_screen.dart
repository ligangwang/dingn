import 'package:dingn/app/app_bar.dart';
import 'package:dingn/account/provider_model.dart';
import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class ProviderScreen<T extends ProviderModel> extends StatelessWidget {
  const ProviderScreen({this.modelBuilder, this.builder});
  final Widget Function(BuildContext context, T value, Widget child) builder;
  final T Function() modelBuilder;  

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<T>(
      builder: (context) => modelBuilder(),
      child: Scaffold(
        resizeToAvoidBottomInset: false,
        appBar: MyAppBar(),
        body: Column(
          children: <Widget>[
            Expanded(
              child:Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  //left panel
                  Container(
                    constraints: const BoxConstraints(maxWidth: 800, maxHeight: 600),
                    child: Consumer<T>(builder: builder),
                  ),
                  //right panel
                ]
              ),
            ),
            copyright(),
          ],
        ),
      )
    );
  }
}


Widget copyright(){
  return const Padding(
    padding: EdgeInsets.all(50),
    child: Text(
      '© dingn 2019',
      style: TextStyle(color: Colors.grey, fontSize: AppTheme.fontSizeFootnote),
    )
  );
}
