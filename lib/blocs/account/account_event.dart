import 'package:dingn/models/account.dart';
import 'package:meta/meta.dart';
import 'package:equatable/equatable.dart';

@immutable
abstract class AccountEvent extends Equatable {
  const AccountEvent();

  @override
  List<Object> get props => null;
}

class ChangeUserNameAccountEvent extends AccountEvent {
  const ChangeUserNameAccountEvent({@required this.userName});

  final String userName;

  @override
  String toString() => 'ChangeUserNameAccountEvent { username :$userName }';

  @override
  List<Object> get props => [userName];
}

class DisplayAccountEvent extends AccountEvent {
  const DisplayAccountEvent({@required this.account});

  final Account account;

  @override
  String toString() => 'DisplayAccountEvent';

  @override
  List<Object> get props => [account?.uid];
}
