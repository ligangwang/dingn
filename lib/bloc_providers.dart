
import 'package:bloc/bloc.dart';
import 'package:dingn/blocs/account/bloc.dart';
import 'package:dingn/blocs/bloc.dart';
import 'package:dingn/blocs/number/bloc.dart';
import 'package:dingn/blocs/number/number_bloc.dart';
import 'package:dingn/blocs/register/register_bloc.dart';
import 'package:dingn/blocs/simple_bloc_delegate.dart';
import 'package:dingn/repository/interface.dart';
import 'package:dingn/repository/number_repository.dart';
import 'package:dingn/repository/user_repository.dart';
import 'package:dingn/repository/word_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

Widget wrapProviders(DBService db, AuthService auth, Widget widget){
  final userRepository = UserRepository(db, auth);
  BlocSupervisor.delegate = SimpleBlocDelegate();
  final numberRepository = NumberRepository(userRepository);
  return MultiBlocProvider(
    providers: [
      BlocProvider<AuthenticationBloc>(builder: (context) {
        return AuthenticationBloc(userRepository);
      }),
      BlocProvider<LoginBloc>(builder: (context) {
        return LoginBloc(userRepository: userRepository);
      }),
      BlocProvider<AccountBloc>(builder: (context) {
        return AccountBloc(userRepository: userRepository);
      }),
      BlocProvider<RegisterBloc>(builder: (context) {
        return RegisterBloc(userRepository: userRepository);
      }),
      BlocProvider<NumberBloc>(
        builder: (context) {
          return NumberBloc(
            repository: numberRepository
          );
        },
      ),
      BlocProvider<NumberDetailBloc>(
        builder: (context) {
          return NumberDetailBloc(
            repository: numberRepository,
            userRepository: userRepository,
            wordRepository: WordRepository(userRepository.db),
          );
        },
      ),
      BlocProvider<PageBloc>(
        builder: (context) {
          return PageBloc();
        },
      )
    ],
    child: widget,
  );    
}