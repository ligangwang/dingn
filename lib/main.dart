import 'package:dingn/account/account_model.dart';
import 'package:flutter/material.dart';

import 'package:dingn/services/firebase_app.dart';
import 'package:dingn/services/firebase_auth_service.dart';
import 'package:dingn/services/firebase_db_service.dart';
import 'package:dingn/app/app.dart';
import 'package:get_it/get_it.dart';
import 'package:dingn/interface.dart';
import 'package:provider/provider.dart';

void main() {
  final app = initialize();
  GetIt.I.registerLazySingleton<DBService>(() => FirebaseDBService(app));
  GetIt.I.registerLazySingleton<AuthService>(() => FirebaseAuthService(app));
  runApp(
    ChangeNotifierProvider<AccountModel>(
      builder: (context) => AccountModel(),
      child: const MyApp(
      'dingn - mind improvement'
      )
    )
  );
}