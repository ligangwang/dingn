import 'package:dingn/models/account.dart';
import 'package:dingn/repository/interface.dart';
import 'package:dingn/ui/app/app_widget.dart';
import 'package:dingn/ui/pages/word/word_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';

class MockDBService extends Mock implements DBService{}
class MockAuthService extends Mock implements AuthService{
  @override
  Stream<Account> get accountChanges => () async*{
    yield null;
  }().asBroadcastStream();
}

void main(){
  MockDBService db;
  MockAuthService auth;
  Widget app;
  
  setUp((){
    db = MockDBService();
    auth = MockAuthService();
    app = myApp('test', db: db, auth: auth);
  });

  tearDown((){
  });

  group('word ui tests', (){
    testWidgets('find word page from app', (WidgetTester tester) async{
      await tester.pumpWidget(app);
      expect(find.byType(WordPage), findsOneWidget);
    });
  });
}