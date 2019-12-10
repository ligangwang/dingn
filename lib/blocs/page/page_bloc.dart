import 'dart:async';
import 'package:bloc/bloc.dart';
import './bloc.dart';

class PageBloc extends Bloc<PageEvent, PageState> {
  @override
  PageState get initialState => const PageState(PageName.Number, null, null);

  @override
  Stream<PageState> mapEventToState(
    PageEvent event,
  ) async* {
    if (event is NavigateToPageEvent) {
      yield event.page;
    }
  }
}
