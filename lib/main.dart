import 'package:dingn/app/app.dart';
import 'package:dingn/interface.dart';
import 'package:dingn/services/firebase_app.dart';
import 'package:dingn/services/firebase_auth_service.dart';
import 'package:dingn/services/firebase_db_service.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:dingn/payment/payment_service.dart';

Future<void> main() async {
  final app = await initialize();
  GetIt.I.registerLazySingleton<DBService>(() => FirebaseDBService(app));
  GetIt.I.registerLazySingleton<AuthService>(() => FirebaseAuthService(app));
  GetIt.I.registerLazySingleton<PaymentService>(() => PaymentService());
  runApp(const MyApp('dingn - mind improvement'));
}
