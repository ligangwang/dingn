import 'package:equatable/equatable.dart';
import 'package:dingn/models/post_model.dart';
import 'package:meta/meta.dart';

@immutable
abstract class PostState extends Equatable {
  @override
  List<Object> get props => const [];
}

/// This is the default state
class PostLoadingState extends PostState {
  @override
  String toString() => 'PostLoading';
}

class PostErrorState extends PostState {
  PostErrorState(this.e);

  final Exception e;

  @override
  String toString() => '$e';
}

class PostLoadedState extends PostState {
  PostLoadedState(this.post);

  final Post post;

  @override
  String toString() => 'PostLoaded';

  @override
  List<Object> get props => [post];
}
