import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';

@immutable
abstract class PostEvent extends Equatable {
  @override
  List<Object> get props => const [];
}

class Fetch extends PostEvent {
  @override
  String toString() => 'Fetch';
}
