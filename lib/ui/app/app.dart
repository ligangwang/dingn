import 'dart:ui';

import 'package:dingn/ui/pages/about/about_page.dart';
import 'package:dingn/ui/pages/account/account_page.dart';
import 'package:dingn/ui/pages/number/number_detail_page.dart';
import 'package:dingn/ui/pages/number/number_page.dart';
import 'package:dingn/ui/widgets/error/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:dingn/blocs/bloc.dart';
import 'package:dingn/ui/app/components/error_listener.dart';
import 'package:dingn/ui/app/components/app_bar.dart';
import 'package:dingn/ui/app/components/overlay_panel.dart';

class App extends StatefulWidget {
  const App({Key key}) : super(key: key);

  @override
  _AppState createState() => _AppState();
}

class _AppState extends State<App> with SingleTickerProviderStateMixin {
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
      body: //SingleChildScrollView(
        NumberErrorListener(
          child: BlocListener<AuthenticationBloc, AuthenticationState>(
            listener: (context, state) {
              _closeAccountPanel(); 
            },
            child: Stack(
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: AppPage(),
                      ),
                      
                    // const CopyrightTailer(),
                      
                    ],
                  ),
                  if (_accountPanelVisible)
                    OverlayPannel(
                      onClosedPressed: _closeAccountPanel,
                      child: const AccountPage(null),
                    ),
                ],
              ),
              
            ),
          ),
        
      );
  }
}


class AppPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PageBloc, PageState>(
      builder: (BuildContext context, PageState state) {
        switch (state.pageName) {
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
            return AccountPage(state.items!=null?state.items[0]:null);
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