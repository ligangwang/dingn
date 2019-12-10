import 'package:equatable/equatable.dart';


class AuthenticationEvent extends Equatable {
  @override
  List<Object> get props => const <dynamic>[];
}

class AppStartedEvent extends AuthenticationEvent {
  @override
  String toString() => 'AppStarted';
}

class LoggedInEvent extends AuthenticationEvent {
  @override
  String toString() => 'LoggedIn';
}

class LoggedOutEvent extends AuthenticationEvent {
  @override
  String toString() => 'LoggedOut';
}