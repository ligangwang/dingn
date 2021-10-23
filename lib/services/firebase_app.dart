import 'package:firebase_core/firebase_core.dart';

Future<FirebaseApp> initialize() async {
  return await Firebase.initializeApp(
      name: 'dingn',
      options: const FirebaseOptions(
          apiKey: 'AIzaSyDzWk1JfjsMi9o_yPBz69XSQmWBXfC8dWs',
          authDomain: 'dingn.com',
          databaseURL: 'https://dingn-193716.firebaseio.com',
          appId: '1:211238433635:android:8d6b181140753ad0',
          projectId: 'dingn-193716',
          storageBucket: 'dingn-193716.appspot.com',
          messagingSenderId: '211238433635'));
}
