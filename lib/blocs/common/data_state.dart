import 'package:dingn/models/number_model.dart';
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';

enum DataState { Loading, Loaded, Error }

@immutable
class BaseDataState extends Equatable{
  const BaseDataState(this.state, this.items, this.hasMoreData, this.e);
  const BaseDataState.initializeState() : this(DataState.Loading, const [], true, null);
  final DataState state;
  final List<Number> items;
  final bool hasMoreData;
  final Exception e;

  @override
  List<Object> get props =>[state, hasMoreData, e] + List<Object>.from(items);

  @override
  String toString() => state.toString();
  
  BaseDataState addItems(List items, bool hasMoreData){
    return BaseDataState(DataState.Loaded, this.items + items, hasMoreData, e);
  }


}


class NumberDataState extends Equatable{
  const NumberDataState(this.activeDigits, this.states);
  factory NumberDataState.initializeState(){
    final intialStates = Map<int, BaseDataState>.from({
        1 : const BaseDataState.initializeState(),
        2 : const BaseDataState.initializeState(),
        3 : const BaseDataState.initializeState(),
        4 : const BaseDataState.initializeState(),
    });
    return NumberDataState(1, intialStates);
  }

  final int activeDigits;
  final Map<int, BaseDataState> states;

  NumberDataState setActiveDigits(int digits){
    return NumberDataState(digits, states);
  }

  NumberDataState addItems(List items, bool hasMoreData){
    final newStates = Map<int, BaseDataState>.fromEntries(states.entries);
    newStates[activeDigits] = newStates[activeDigits].addItems(items, hasMoreData);
    final x = NumberDataState(activeDigits, newStates);
    return x;
  }

  NumberDataState changeItem(Object item){
    final newStates = Map<int, BaseDataState>.fromEntries(states.entries);
    final x = NumberDataState(activeDigits, newStates);
    x.activeState.items[x.activeState.items.indexOf(item)] = item;
    return x;
  }

  @override
  List<Object> get props => List<Object>.from([activeDigits]) + activeState.props;

  BaseDataState get activeState => states[activeDigits];
}

