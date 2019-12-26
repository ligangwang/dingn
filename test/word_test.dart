import 'package:dingn/bloc_providers.dart';
import 'package:dingn/models/account.dart';
import 'package:dingn/repository/interface.dart';
import 'package:dingn/themes.dart';
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
  Widget wordPage;

  setUp((){
    db = MockDBService();
    auth = MockAuthService();
    wordPage = wrapProviders(
      db, auth, 
      MaterialApp(
        title: 'test',
        theme: AppTheme.theme(),
        debugShowCheckedModeBanner: false,
        home: WordPage(),
      )
    );
  });

  tearDown((){
  });

  group('word ui tests', (){
    testWidgets('word ui display Hello text', (WidgetTester tester) async{
      await tester.pumpWidget(wordPage);
      expect(find.text('Hello'), findsOneWidget);
    });
  });
}