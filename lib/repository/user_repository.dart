import 'package:dingn/models/account.dart';
import 'package:firebase/firebase.dart';
import 'package:firebase/firestore.dart';


class UserRepository {
  UserRepository(App app)
      : _firebaseAuth = auth(app),
        _db = firestore(app),
        _app = app,
        _googleSignIn = GoogleAuthProvider(){
          _firebaseAuth.onAuthStateChanged.listen((User user){
            _user = user;
            _account = _mapUserToAccount(user);
          });
        }

  Account _mapUserToAccount(User user){
    if (user == null)
      return null;
    getUserName(user.uid).then((userName){
      _account = _account.changeUserName(userName ?? user.displayName);
    });
    
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
  final App _app;
  final GoogleAuthProvider _googleSignIn;
  final Firestore _db;
  User _user;
  Account _account;
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

  Future<bool> changeUserName(String userName) async {
    try{
      final docRef = _db.collection('accounts').doc(uid);
      await docRef.set({'user_name': userName});
      _account = _account.changeUserName(userName);
      return true;
    }catch(e){
      rethrow;
    }
  }

  Future<String> getUserName(String uid) async {
      final docRef = _db.collection('accounts').doc(uid);
      final docSnapshot = await docRef.get();
      return docSnapshot.data() == null? null : docSnapshot.data()['user_name'];
  }

  Future<bool> checkUserNameExists(String userName) async {
    try{
      final querySnapshot = await _db.collection('accounts')
          .where('user_name', '==', userName)
          .get();
      return querySnapshot.docs.isNotEmpty;
    }catch(e){
      rethrow;
    }
  }

  bool get isSignedIn =>  _user != null;
  String get displayName => _user?.displayName;
  String get uid => _user?.uid;
  String get photoURL => _user?.photoURL;
  String get email => _user?.email;
  Account get account => _account;
  String get userName => _account?.userName;
  App get app => _app;
 
}