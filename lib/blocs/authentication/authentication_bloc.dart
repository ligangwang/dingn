import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:firebase/firebase.dart';
import 'package:dingn/repository/user_repository.dart';
import 'bloc.dart';

class AuthenticationBloc
    extends Bloc<AuthenticationEvent, AuthenticationState> {
  AuthenticationBloc(UserRepository userRepository){
    _userRepository = userRepository;
    userRepository.listen(onAuthChange);

    add(AppStartedEvent());
  }


  UserRepository _userRepository;

  @override
  AuthenticationState get initialState => Uninitialized();

  @override
  Stream<AuthenticationState> mapEventToState(
    AuthenticationEvent event,
  ) async* {
    if (event is AppStartedEvent) {
      yield* _mapAppStartedToState();
    } else if (event is LoggedInEvent) {
      yield* _mapLoggedInToState();
    } else if (event is LoggedOutEvent) {
      yield* _mapLoggedOutToState();
    }
  }

  Stream<AuthenticationState> _mapAppStartedToState() async* {
    try {
      if (_userRepository.isSignedIn) {
        final name = _userRepository.displayName;
        yield Authenticated(name, _userRepository.photoURL, _userRepository.email);
      } else {
        yield Unauthenticated();
      }
    } catch (_) {
      yield Unauthenticated();
    }
  }

  Stream<AuthenticationState> _mapLoggedInToState() async* {
    yield Authenticated(_userRepository.displayName, _userRepository.photoURL, _userRepository.email);
  }

  Stream<AuthenticationState> _mapLoggedOutToState() async* {
    yield Unauthenticated();
  }

  void signOut(){
    _userRepository.signOut();
  }

  void onAuthChange(User user){
    add(user==null ? LoggedOutEvent() : LoggedInEvent());
  }
}
