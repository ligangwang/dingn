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
  Authenticated(this.displayName, this.photoURL, this.email);

  final String displayName;
  final String photoURL;
  final String email;

  @override
  String toString() => 'Authenticated { displayName: $displayName }';

  @override
  List<Object> get props => [displayName, photoURL];

  String get initials => (displayName ?? email).substring(1, 3);
}

class Unauthenticated extends AuthenticationState {
  @override
  String toString() => 'Unauthenticated';
}
