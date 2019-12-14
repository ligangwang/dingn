import 'package:dingn/models/account.dart';
import 'package:meta/meta.dart';

@immutable
class AccountState {
  const AccountState({
    @required this.isSubmitting,
    @required this.isSuccess,
    @required this.isFailure,
    @required this.userName,
    @required this.account,
    this.errorMessage = '',
  });

  factory AccountState.empty() {
    return const AccountState(
      isSubmitting: false,
      isSuccess: false,
      isFailure: false,
      userName: '',
      account: null
    );
  }


  AccountState failure(String userName, String errorMessage) {
    return AccountState(
      isSubmitting: false,
      isSuccess: false,
      isFailure: true,
      errorMessage: errorMessage,
      userName: userName,
      account: account
    );
  }

  AccountState success(String userName) {
    return AccountState(
      isSubmitting: false,
      isSuccess: true,
      isFailure: false,
      userName: userName,
      account: account.changeUserName(userName)
    );
  }

  AccountState setAccount(Account account) {
    return AccountState(
      isSubmitting: false,
      isSuccess: true,
      isFailure: false,
      userName: userName,
      account: account
    );
  }

  final bool isSubmitting;
  final bool isSuccess;
  final bool isFailure;
  final String errorMessage;
  final String userName;
  final Account account;

  AccountState update({
    String errorMessage
  }) {
    return copyWith(
      errorMessage: errorMessage,
      isSubmitting: false,
      isSuccess: false,
      isFailure: false,
    );
  }

  AccountState copyWith({
    bool isSubmitting,
    bool isSuccess,
    bool isFailure,
    String errorMessage,
    String userName,
    Account account
  }) {
    return AccountState(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isSuccess: isSuccess ?? this.isSuccess,
      isFailure: isFailure ?? this.isFailure,
      errorMessage: errorMessage ?? this.errorMessage,
      userName: userName ?? this.userName,
      account: account ?? this.account
    );
  }

  @override
  String toString() {
    return '''AccountState {
      isSubmitting: $isSubmitting,
      isSuccess: $isSuccess,
      isFailure: $isFailure,
      errorMessage: $errorMessage,
      userName: $userName,
    }''';
  }
}