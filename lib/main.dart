import 'package:dingn/services/firebase_app.dart';
import 'package:dingn/services/firebase_auth_service.dart';
import 'package:dingn/services/firebase_db_service.dart';
import 'package:flutter/material.dart';

import 'package:dingn/bloc_providers.dart';
import 'package:dingn/ui/app/app_widget.dart';
import 'package:dingn/themes.dart';

void main() {
  final app = initialize();
  final mainWidget = wrapProviders(
    FirebaseDBService(app),
    FirebaseAuthService(app),
    MaterialApp(
      title: 'dingn - mind improvement',
      theme: AppTheme.theme(),
      debugShowCheckedModeBanner: false,
      home: const AppWidget(),
  ));
  runApp(mainWidget);
}

