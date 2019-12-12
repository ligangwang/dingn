import 'package:dingn/models/account.dart';
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';

@immutable
abstract class AuthenticationState extends Equatable {
  @override
  List<Object> get props => const <dynamic>[];
}

class Uninitialized extends AuthenticationState {
  @override
  String toString() => 'Uninitialized';
}

class Authenticated extends AuthenticationState {
  Authenticated(this.account);

  final Account account;

  @override
  String toString() => 'Authenticated { userName: ${account.userName} }';

  @override
  List<Object> get props => [account.userName, account.photoURL];

}

class Unauthenticated extends AuthenticationState {
  @override
  String toString() => 'Unauthenticated';
}
