import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:dingn/blocs/common/bloc.dart';
import 'package:dingn/models/number_model.dart';
import 'package:dingn/models/word_model.dart';
import 'package:dingn/repository/number_repository.dart';
import 'package:dingn/repository/user_repository.dart';
import 'package:dingn/repository/word_repository.dart';
import 'package:equatable/equatable.dart';

class NumberDetailDataState extends Equatable{
  const NumberDetailDataState(this.number, this.uid);
  factory NumberDetailDataState.initializeState(){
    return const NumberDetailDataState(null, null);
  }
  final Number number;
  final String uid;

  @override
  List<Object> get props => [number?.number, number?.myFavoriteWord, number?.mostFavoriteWord, uid];

  NumberDetailDataState setNumber(Number number, String uid){
    return NumberDetailDataState(number, uid);
  }

  NumberDetailDataState setUser(String uid){
    return NumberDetailDataState(number, uid);
  }


  NumberDetailDataState setFavorite(String favorite){
    return NumberDetailDataState(number.setMyFavoriteWord(favorite), uid);
  }
}

class NumberDetailDataEvent extends DataEvent{}

class ShowDetailDataEvent extends NumberDetailDataEvent {
  ShowDetailDataEvent(this.numbers, this.itemIndex);

  final List<Number> numbers;
  final int itemIndex;
  Number get number => numbers[itemIndex];
  @override
  String toString() => 'ShowDetailDataEvent';
}

class SetFavoriteDataEvent extends NumberDetailDataEvent {
  SetFavoriteDataEvent(this.number, this.favorite);

  final String favorite;
  final Number number;

  @override
  String toString() => 'SetFavoriteDataEvent';
}

class SetUserDataEvent extends NumberDetailDataEvent {
  SetUserDataEvent(this.uid);

  final String uid;

  @override
  String toString() => 'SetUserDataEvent';
}

class NumberDetailBloc extends Bloc<NumberDetailDataEvent, NumberDetailDataState> {
  NumberDetailBloc({this.repository, this.userRepository, this.wordRepository}){
    userRepository.accountChanges.listen((user){
      add(SetUserDataEvent(user?.uid));
    });
  }
      
  final NumberRepository repository;
  final UserRepository userRepository;
  final WordRepository wordRepository;

  @override
  NumberDetailDataState get initialState => NumberDetailDataState.initializeState();

  @override
  Stream<NumberDetailDataState> mapEventToState(
    NumberDetailDataEvent event,
  ) async* {
    if (event is ShowDetailDataEvent){
      yield state.setNumber(event.number, userRepository.uid);
    }
    else if (event is SetUserDataEvent){
      yield state.setUser(event.uid);
    }
    else if (event is SetFavoriteDataEvent && event.favorite != state.number.myFavoriteWord) {
      yield state.setFavorite(event.favorite);
      await repository.setFavoriteWord(event.number.number, event.favorite, userRepository.uid);
      if (state.number.myFavoriteWord!=null){
        await decFavoriteCount(event.number.myFavoriteWord, event.number.number);
      }
      final favoriteCount = await incFavoriteCount(event.favorite, event.number.number);
      if (favoriteCount > event.number.mostFavoriteCount){
        final number = event.number.setMostFavoriteWord(event.favorite, favoriteCount);
        await repository.setNumber(number);
      }
    }
  }

  Future<int> incFavoriteCount (String word, String number) async {
    final wordObj = await wordRepository.getWord(word, number) ?? Word(word, null, number, 0);
    wordObj.favoriteCount += 1;
    await wordRepository.setWord(wordObj);
    return wordObj.favoriteCount;
  }

  Future<int> decFavoriteCount (String word, String number) async {
    final wordObj = await wordRepository.getWord(word, number) ?? Word(word, null, number, 0);
    wordObj.favoriteCount -= 1;
    await wordRepository.setWord(wordObj);
    return wordObj.favoriteCount;
  }
}
