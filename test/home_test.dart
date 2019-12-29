import 'package:dingn/account/account.dart';
import 'package:dingn/app/app.dart';
import 'package:dingn/home/home_screen.dart';
import 'package:dingn/interface.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mockito/mockito.dart';

class MockDBService extends Mock implements DBService{}
class MockAuthService extends Mock implements AuthService{
  @override
  Stream<Account> get accountChanges => () async*{
    yield null;
  }().asBroadcastStream();
}

void main(){
  Widget app;
  
  setUp((){
    GetIt.I.registerLazySingleton<DBService>(() => MockDBService());
    GetIt.I.registerLazySingleton<AuthService>(() => MockAuthService());
    app = const MyApp('test');
  });

  tearDown((){
  });

  group('home ui tests', (){
    testWidgets('find home screen from app', (WidgetTester tester) async{
      await tester.pumpWidget(app);
      expect(find.byType(HomeScreen), findsOneWidget);
    });
  });
}