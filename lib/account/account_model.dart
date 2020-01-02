import 'package:dingn/account/account.dart';
import 'package:dingn/account/provider_model.dart';
import 'package:dingn/interface.dart';
import 'package:get_it/get_it.dart';

class AccountModel extends ProviderModel{
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
      notifyListeners();
    });
  }

  final DBService _db = GetIt.instance.get<DBService>();
  final AuthService _auth = GetIt.instance.get<AuthService>();

  Stream<Account> _accountChanges;
  Account _account;
  Stream<Account> get accountChanges => _accountChanges;
  bool editMode = false;
  void setEditMode(bool isEditMode){
    if (isEditMode != editMode){
      editMode = isEditMode;
      notifyListeners();
    }
  }

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
    await _auth.signOut();
  }

  Future<void> sendPasswordResetEmail(String email) async {
    return await _auth.sendPasswordResetEmail(email);
  }

  Future<bool> changeUserName(String userName) async {
    try{
      _account = _account.changeUserName(userName);
      await _db.setDoc('accounts', uid, {'user_name': userName});
      print('saved username: $userName');
      return true;
    }catch(e){
      rethrow;
    }
  }

  Future<String> getUserName(String uid) async {
    try{
      final data = await _db.getDoc('accounts', uid);
      return data!=null? data['user_name']:null;
    }catch(e){
      print('get user name error: $e');
    }
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