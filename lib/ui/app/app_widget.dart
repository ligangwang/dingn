import 'dart:ui';

import 'package:dingn/bloc_providers.dart';
import 'package:dingn/repository/interface.dart';
import 'package:dingn/themes.dart';
import 'package:dingn/ui/pages/about/about_page.dart';
import 'package:dingn/ui/pages/account/account_page.dart';
import 'package:dingn/ui/pages/number/number_detail_page.dart';
import 'package:dingn/ui/pages/number/number_page.dart';
import 'package:dingn/ui/pages/word/word_page.dart';
import 'package:dingn/ui/widgets/error/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:dingn/blocs/bloc.dart';
import 'package:dingn/ui/app/error_listener.dart';
import 'package:dingn/ui/app/app_bar.dart';
import 'package:dingn/ui/app/overlay_panel.dart';

Widget myApp(String title, {DBService db, AuthService auth}){
  return wrapProviders(
    db,
    auth,
    MaterialApp(
      title: title,
      theme: AppTheme.theme(),
      debugShowCheckedModeBanner: false,
      home: const AppWidget(),
  ));
}

class AppWidget extends StatefulWidget {
  const AppWidget({Key key}) : super(key: key);

  @override
  _AppState createState() => _AppState();
}

class _AppState extends State<AppWidget> with SingleTickerProviderStateMixin {
  bool isSmallScreen = false;
  bool _accountPanelVisible = true;

  void _setScreenSize(Size screenSize) {
    if (screenSize.width < 750) {
      setState(() {
        isSmallScreen = true;
      });
    } else if (isSmallScreen == true) {
      setState(() {
        isSmallScreen = false;
      });
    } 
    print('is small screen $isSmallScreen, $screenSize');
}

  void _openLoginPannel() {
    setState(() {
      _accountPanelVisible = true;
    });
  }

  void _closeAccountPanel() {
    setState(() {
      _accountPanelVisible = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    _setScreenSize(MediaQuery.of(context).size);
    return Scaffold(
      resizeToAvoidBottomPadding: false,
      appBar: MyAppBar(
        loginPressed: _openLoginPannel
      ),
      body: NumberErrorListener(
            child: BlocListener<AuthenticationBloc, AuthenticationState>(
              listener: (context, state) {
                _closeAccountPanel(); 
              },
              child:Stack(
                children: <Widget>[
                  ListView(
                    children: <Widget>[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                          Container(
                            constraints: isSmallScreen? null:const BoxConstraints(maxWidth: 800, maxHeight: 600),
                            child: _AppPage(),
                          ),
                        ],
                      ),
                      if (!isSmallScreen)
                        copyrightTailer(),
                    ],
                  ),
                  if (_accountPanelVisible)
                    OverlayPannel(
                      onClosedPressed: _closeAccountPanel,
                      child: const AccountPage(null, null),
                    ),
                ],
              ),
            ),
          
      )
    );
  }
}

Widget copyrightTailer(){
  return const Padding(
    padding: EdgeInsets.all(50),
    child: Center(
      child: Text(
        '© dingn 2019',
        style: TextStyle(color: Colors.grey, fontSize: AppTheme.fontSizeFootnote),
      )
    )
  );
}

class _AppPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PageBloc, PageState>(
      builder: (BuildContext context, PageState state) {
        switch (state.pageName) {
          case PageName.Word:
            return WordPage();
          case PageName.Number:
            return NumberPage();
            break;
          case PageName.NumberDetail:
            return NumberDetailPage(numbers: state.items, itemIndex: state.itemIndex);
            break;
          case PageName.About:
            return AboutPage();
            break;
          case PageName.Account:
            return AccountPage(state.items!=null?state.items[0]:null, state.account);
            break;
          default:
            return const CustomError(
              errorMessage:
                  'something wrong',
            );
            break;
        }
      },
    );
  }
}