import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dingn/blocs/bloc.dart';
import 'package:dingn/themes.dart';

class MyAppBar extends StatelessWidget implements PreferredSizeWidget {
  const MyAppBar({
    Key key,
    @required this.loginPressed
  })  : super(key: key);


  final VoidCallback loginPressed;

  void _loginPressed() {
    if (loginPressed != null) {
      loginPressed();
    }
  }

  @override
  Widget build(BuildContext context) {
    final pageBloc = BlocProvider.of<PageBloc>(context);

    return AppBar(
      title: GestureDetector(
        onTap: () {
          pageBloc.add(NavigateToPageEvent(const PageState(PageName.Number, null, null)));
        },
        child: const Text(
          'dingn',
          style: TextStyle(color: AppTheme.accentColor, fontWeight: FontWeight.bold),
        ),
      ),
      backgroundColor: Colors.transparent,
      elevation: 0,
      actions: <Widget>[
        BlocBuilder<AuthenticationBloc, AuthenticationState>(
          builder: (context, state) {
            if (state is Authenticated) {
              return FlatButton(
                onPressed: () {
                  pageBloc.add(NavigateToPageEvent(const PageState(PageName.Account, null, null)));
                },
                shape: const CircleBorder(side: BorderSide.none),
                child: CircleAvatar(
                  backgroundImage: state.photoURL!=null?NetworkImage(state.photoURL):null,
                  child: Text(state.photoURL!=null?'':state.initials),
                ),
              );
            } else {
              return FlatButton(
                onPressed: _loginPressed,
                child: const Text(
                  'Login',
                  style: TextStyle(color: AppTheme.accentColor, fontWeight: FontWeight.bold),
                ),
              );
            }
          },
        ),
      ],
      // bottom: const TabBar(
      //   tabs: [
      //     Tab(icon: Icon(Icons.view_list)),
      //     Tab(icon: Icon(Icons.language)),
      //   ],
      //),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(56.0);
}
