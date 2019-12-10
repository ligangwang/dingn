import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';

@immutable
abstract class DataEvent extends Equatable {
  @override
  List<Object> get props => const [];
}

class FetchDataEvent extends DataEvent {
  @override
  String toString() => 'FetchDataEvent';
}

class ChangeDigitDataEvent extends DataEvent {
  ChangeDigitDataEvent(this.digits);

  final int digits;
  @override
  String toString() => 'ChangeDigitDataEvent: $digits';
}