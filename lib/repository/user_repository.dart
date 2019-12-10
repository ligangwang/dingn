import 'package:firebase/firebase.dart';


class UserRepository {
  UserRepository({Auth firebaseAuth, GoogleAuthProvider googleSignin})
      : _firebaseAuth = firebaseAuth ?? auth(),
        _googleSignIn = googleSignin ?? GoogleAuthProvider(){
          _firebaseAuth.onAuthStateChanged.listen((User user){
            _user = user;
          });
        }

  final Auth _firebaseAuth;
  final GoogleAuthProvider _googleSignIn;
  User _user;

  void listen(onUserChange){
      _firebaseAuth.onAuthStateChanged.listen(onUserChange);
  }

  Future<UserCredential> signInWithGoogle() async {
    try {
      return await _firebaseAuth.signInWithPopup(_googleSignIn);
    } catch (e) {
      print('Error in sign in with google: $e');
      throw '$e';
    }
  }

  Future<UserCredential> signInWithCredentials(
      String email, String password) async {
    try {
      return await _firebaseAuth.signInWithEmailAndPassword(email, password);
    } catch (e) {
      print('Error in sign in with credentials: $e');
      // return e;
      throw '$e';
    }
  }

  Future<UserCredential> signUp({String email, String password}) async {
    try {
      return await _firebaseAuth.createUserWithEmailAndPassword(
        email,
        password,
      );
    } catch (e) {
      print('Error siging in with credentials: $e');
      throw '$e';
      // throw Error('Error signing up with credentials: $e');
      // return e;
    }
  }

  Future<dynamic> signOut() async {
    try {
      return Future.wait([
        _firebaseAuth.signOut(),
      ]);
    } catch (e) {
      print ('Error signin out: $e');
      // return e;
      throw '$e';
    }
  }

  // Future<bool> isSignedIn() async {
  //   final currentUser = _firebaseAuth.currentUser;
  //   return currentUser != null;
  // }

  Future<String> getUser() async {
    return (_firebaseAuth.currentUser).email;
  }

  bool get isSignedIn =>  _user != null;
  String get displayName => _user?.displayName;
  String get uid => _user?.uid;
  String get photoURL => _user?.photoURL;
  String get email => _user?.email;
 
}