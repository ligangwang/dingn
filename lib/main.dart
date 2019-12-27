import 'package:flutter/material.dart';

import 'package:dingn/services/firebase_app.dart';
import 'package:dingn/services/firebase_auth_service.dart';
import 'package:dingn/services/firebase_db_service.dart';
import 'package:dingn/ui/app/app_widget.dart';

void main() {
  final app = initialize();
  runApp(
    myApp(
      'dingn - mind improvement',
      db: FirebaseDBService(app), 
      auth: FirebaseAuthService(app),
    )
  );
}