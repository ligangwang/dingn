import 'package:dingn/account/account.dart';
import 'package:dingn/interface.dart';
import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';

class AccountModel extends ChangeNotifier{
  AccountModel(){
    _accountChanges = _auth.accountChanges.asyncMap((Account account) async{
      if (account == null){
        return account;
      }else{
        final userName = await getUserName(account.uid);
        return account.changeUserName(userName ?? account.fullName);
      }
    });
    _accountChanges.listen((Account account){
      _account = account;
    });
  }

  final DBService _db = GetIt.instance.get<DBService>();
  final AuthService _auth = GetIt.instance.get<AuthService>();

  AuthService get auth => _auth;
  DBService get db => _db;
  Stream<Account> _accountChanges;
  Account _account;
  Stream<Account> get accountChanges => _accountChanges;

  //ui stuff
  String _errorMessage;
  final bool _isFormValid = false;
  final bool _isSubmitting = false;
  final bool _isSuccess = false;
  final bool _isEmailValid = false;
  final bool _isPasswordValid = false;
  String get errorMessage => _errorMessage;
  bool get isFormValid => _isFormValid;
  bool get isSubmitting => _isSubmitting;
  bool get isSuccess => _isSuccess;
  bool get isEmailValid => _isEmailValid;
  bool get isPasswordValid => _isPasswordValid;

  Future<Account> signInWithGoogle() async {
    return await _auth.signInWithGoogle();
  }

  Future<Account> signInWithCredentials(
      {String email, String password}) async {
    return await _auth.signInWithCredentials(email, password);
  }

  Future<Account> signUp({String email, String password}) async {
    return await _auth.signUp(email, password);
  }

  Future<dynamic> signOut() async {
    return await _auth.signOut();
  }

  Future<void> sendPasswordResetEmail(String email) async {
    return await _auth.sendPasswordResetEmail(email);
  }

  Future<bool> changeUserName(String userName) async {
    try{
      await _db.setDoc('accounts', uid, {'user_name': userName});
      _account = _account.changeUserName(userName);
      return true;
    }catch(e){
      rethrow;
    }
  }

  Future<String> getUserName(String uid) async {
      final data = await _db.getDoc('accounts', uid);
      return data['user_name'];
  }

  Future<bool> checkUserNameExists(String userName) async {
    return await _db.exists('accounts', 'user_name', userName);
  }

  bool get isSignedIn =>  _account != null;
  String get displayName => _account?.userName;
  String get uid => _account?.uid;
  String get photoURL => _account?.photoURL;
  String get email => _account?.email;
  Account get account => _account;
  String get userName => _account?.userName;
}