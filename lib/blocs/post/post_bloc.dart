import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:flutter/material.dart';
import 'package:dingn/models/post_model.dart';
import 'package:dingn/repository/post_repository.dart';
import 'post_event.dart';
import 'post_state.dart';

class PostBloc extends Bloc<PostEvent, PostState> {
  PostBloc({@required PostRepository postRepository})
      : assert(postRepository != null),
        _postRepository = postRepository;

  final PostRepository _postRepository;

  @override
  PostState get initialState => PostLoadingState();

  @override
  Stream<PostState> mapEventToState(
    PostEvent event,
  ) async* {
    if (event is Fetch) {
      yield* _mapFetchToState();
    }
  }

  Stream<PostState> _mapFetchToState() async* {
    try {
      if ((state is PostLoadingState) || (state is PostErrorState)) {
        final Post post = await _postRepository.getPost();
        yield PostLoadedState(post);
        return;
      }
    } catch (e) {
      yield PostErrorState(e);
    }
  }
}
