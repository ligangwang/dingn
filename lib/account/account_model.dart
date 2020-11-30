import 'package:dingn/account/account.dart';
import 'package:dingn/account/provider_model.dart';
import 'package:dingn/interface.dart';
import 'package:enum_to_string/enum_to_string.dart';
import 'package:get_it/get_it.dart';

class AccountModel extends ProviderModel {
  AccountModel() {
    _accountChanges = _auth.accountChanges.asyncMap((Account account) async {
      if (account == null) {
        return account;
      } else {
        final accountInfo = await getAccountInfo(account.uid);
        return account.changeAccountInfo(accountInfo);
      }
    });
    _accountChanges.listen((Account account) {
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
  void setEditMode(bool isEditMode) {
    if (isEditMode != editMode) {
      editMode = isEditMode;
      notifyListeners();
    }
  }

  Future<bool> setCardSide(CardSide side) async {
    print('set card side: $cardSide, $side');
    if (cardSide != side) {
      _account = _account.changeCardSide(side);
      notifyListeners();
      await _saveAccount(_account);
    }
    return true;
  }

  Future<Account> signInWithGoogle() async {
    return await _auth.signInWithGoogle();
  }

  Future<Account> signInWithCredentials({String email, String password}) async {
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
    try {
      _account = _account.changeUserName(userName);
      await _saveAccount(_account);
      return true;
    } catch (e) {
      print('saved username: $userName error: $e');
      return false;
    }
  }

  Future<bool> _saveAccount(Account account) async {
    print('saving account: $uid, ${account.userName}, ${account.cardSide}');
    try {
      final cardSide = EnumToString.convertToString(account.cardSide);
      await _db.setDoc('accounts', uid,
          {'user_name': account.userName, 'card_side': cardSide});
      return true;
    } catch (e) {
      print('_saveAccount error: $e');
      return false;
    }
  }

  Future<Account> getAccountInfo(String uid) async {
    try {
      final data = await _db.getDoc('accounts', uid);
      final String side = data != null ? data['card_side'] : null;
      final CardSide cardSide = side != null
          ? EnumToString.fromString(CardSide.values, side)
          : CardSide.OneSide;
      return Account(
          userName: data != null ? data['user_name'] : null,
          cardSide: cardSide);
    } catch (e) {
      print('get user name error: $e');
      return null;
    }
  }

  Future<bool> checkUserNameExists(String userName) async {
    return await _db.exists('accounts', 'user_name', userName);
  }

  bool get isSignedIn => _account != null;
  String get displayName => _account?.userName;
  String get uid => _account?.uid;
  String get photoURL => _account?.photoURL;
  String get email => _account?.email;
  Account get account => _account;
  String get userName => _account?.userName;
  CardSide get cardSide => _account?.cardSide;
}
