import 'package:dingn/account/account.dart';
import 'package:dingn/interface.dart';
import 'package:firebase/firebase.dart';


class FirebaseAuthService implements AuthService {
  FirebaseAuthService(App app)
      : _firebaseAuth = auth(app),
        _googleSignIn = GoogleAuthProvider(){
        _accountChanges = _firebaseAuth.onAuthStateChanged.map((User user)=>_mapUserToAccount(user));
      }

  Account _mapUserToAccount(User user){
    if (user == null)
      return null;
    return Account(
      userName: null,
      uid: user.uid,
      email: user.email,
      photoURL: user.photoURL,
      fullName: user.displayName,
      occupation: '',
      bio: '',
      followers: 0,
      following: 0,
      level: 0
      );
  }

  final Auth _firebaseAuth;
  final GoogleAuthProvider _googleSignIn;
  Stream<Account> _accountChanges;

  @override
  Stream<Account> get accountChanges => _accountChanges;
  
  @override
  Future<Account> signInWithGoogle() async {
    try {
      final userCredential = await _firebaseAuth.signInWithPopup(_googleSignIn);
      return _mapUserToAccount(userCredential.user);
    } catch (e) {
      print('Error in sign in with google: $e');
      return null;
    }
  }

  @override
  Future<Account> signInWithCredentials(
      String email, String password) async {
    try {
      final userCredential = await _firebaseAuth.signInWithEmailAndPassword(email, password);
      return _mapUserToAccount(userCredential.user);
    } catch (e) {
      print('Error in sign in with credentials: $e');
      return null;
      //throw '$e';
    }
  }

  @override
  Future<Account> signUp(String email, String password) async {
    try {
      final userCredential = await _firebaseAuth.createUserWithEmailAndPassword(
        email,
        password,
      );
      return _mapUserToAccount(userCredential.user);
    } catch (e) {
      print('Error siging up with credentials: $e');
      return null;
    }
  }

  @override
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _firebaseAuth.sendPasswordResetEmail(
        email
      );      
    } catch (e) {
      print('Error reset password with email: $e');
      throw '$e';
    }
  }


  @override
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
}