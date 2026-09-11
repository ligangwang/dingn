import 'package:dingn/account/account.dart';
import 'package:dingn/account/signin_screen.dart';
import 'package:dingn/app/app.dart';
import 'package:dingn/home/home_screen.dart';
import 'package:dingn/interface.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mockito/mockito.dart';

class MockDBService extends Mock implements DBService {}

class MockAuthService extends Mock implements AuthService {
  @override
  Stream<Account?> get accountChanges => Stream<Account?>.value(null);
}

void main() {
  setUp(() {
    GetIt.I.registerLazySingleton<DBService>(() => MockDBService());
    GetIt.I.registerLazySingleton<AuthService>(() => MockAuthService());
  });
  tearDown(() async => GetIt.I.reset());

  for (final width in [320.0, 390.0, 1280.0]) {
    testWidgets('home and sign-in fit a $width pixel viewport', (tester) async {
      tester.view.physicalSize = Size(width, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const MyApp('dingn'));
      await tester.pumpAndSettle();
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.text('Numbers').last);
      await tester.tap(find.text('Numbers').last);
      await tester.pumpAndSettle();
      expect(find.byType(SigninScreen), findsOneWidget);
      expect(find.text('Continue with Google'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
