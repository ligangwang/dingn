import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:dingn/utils/validator.dart';
import 'package:meta/meta.dart';
import 'package:dingn/repository/user_repository.dart';
import './bloc.dart';

class AccountBloc extends Bloc<AccountEvent, AccountState> {
  AccountBloc({
    @required UserRepository userRepository,
  })  : assert(userRepository != null),
        _userRepository = userRepository;

  final UserRepository _userRepository;

  @override
  AccountState get initialState => AccountState.empty();

  @override
  Stream<AccountState> mapEventToState(AccountEvent event) async* {
    if (event is DisplayAccountEvent)
      yield state.setAccount(_userRepository.account);
    if (event is ChangeUserNameAccountEvent && event.userName != _userRepository.userName && _userRepository.uid != null) {
      yield* _mapUserNameChangedToState(event.userName);
    } 
  }

  Stream<AccountState> _mapUserNameChangedToState(String userName) async* {
    var isValidUserName = Validators().isValidUserName(userName);
    if(!isValidUserName){
      yield state.failure(userName, 'invalid user name format');
      return;
    }
    if(await _userRepository.checkUserNameExists(userName)){
      yield state.failure(userName, 'The user name has already taken.');
      return;
    }
    isValidUserName = await _userRepository.changeUserName(userName);
    if(isValidUserName)
      yield state.success(userName);
    else
      yield state.failure(userName, 'saving error');
  }
}