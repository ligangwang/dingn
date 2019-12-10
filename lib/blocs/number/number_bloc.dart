import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:dingn/blocs/common/bloc.dart';
import 'package:dingn/blocs/number/bloc.dart';
import 'package:dingn/models/number_model.dart';
import 'package:dingn/repository/number_repository.dart';
import 'package:flutter/material.dart';

class NumberBloc extends Bloc<DataEvent, NumberDataState> {
  NumberBloc({@required NumberRepository repository})
      : assert(repository != null),
        _repository = repository;

  final NumberRepository _repository;

  @override
  NumberDataState get initialState => NumberDataState.initializeState();

  // @override
  // Stream<NumberDataState> transformStates(Stream<NumberDataState> states) {
  //   return super.transformStates(
  //     (states as Observable<NumberDataState>).debounceTime(
  //       const Duration(milliseconds: 500),
  //     ));
  // }

  @override
  Stream<NumberDataState> mapEventToState(
    DataEvent event,
  ) async* {
    if (event is ChangeDigitDataEvent && event.digits != state.activeDigits){
      final newState = state.setActiveDigits(event.digits);
      if(newState.activeState.items.isEmpty)
        add(FetchDataEvent());
      yield newState;
    }
    else if (event is SetFavoriteDataEvent){
      final number = event.number.setMyFavoriteWord(event.favorite);
      yield state.changeItem(number);
    }
    else if (event is FetchDataEvent && _hasMoreData(event, state)) {
      yield* _mapFetchToState(event, state);
    }
  }

  bool _hasMoreData(FetchDataEvent event, NumberDataState state){
      return state.activeState.state != DataState.Loaded || state.activeState.hasMoreData;
  }

  Stream<NumberDataState> _mapFetchToState(FetchDataEvent event, NumberDataState state) async* {
    try {
      final List<Number> numbers = await _repository.retrieveData(state.activeDigits, 20);
      yield state.addItems(numbers, numbers.length >= 20);
      return;
    } catch (e, s) {
      //yield NumberDataState.makeErrorState(e);
      print('something wrong in retrieving: $e: $s');
      rethrow;
    }
  }
}
