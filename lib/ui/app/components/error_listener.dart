import 'package:dingn/blocs/bloc.dart';
import 'package:dingn/blocs/number/number_bloc.dart';
import 'package:dingn/ui/widgets/common/snackbar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class NumberErrorListener extends StatelessWidget {
  const NumberErrorListener({Key key, this.child}) : super(key: key);
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      child: MultiBlocListener(
        listeners: [
          BlocListener<NumberBloc, NumberDataState>(
            listener: (context, state) {
              if (state.activeState.state == DataState.Error) {
                Scaffold.of(context)
                  ..removeCurrentSnackBar()
                  ..showSnackBar(
                    SnackBar(
                      content: ErrorSnackbar(
                        message: 'Could not load data: $state',
                      ),
                    ),
                  );
              }
            },
          ),
        ],
        child: child,
      ),
    );
  }
}