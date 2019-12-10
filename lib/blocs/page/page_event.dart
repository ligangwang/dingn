import 'package:equatable/equatable.dart';
import 'package:dingn/blocs/page/page_state.dart';
import 'package:meta/meta.dart';

@immutable
abstract class PageEvent extends Equatable {
  @override
  List<Object> get props => const [];
}

class NavigateToPageEvent extends PageEvent {
  NavigateToPageEvent(this.page);

  final PageState page;

  @override
  String toString() => 'NavigateToPageEvent: {page: $page}';

  @override
  List<Object> get props => [page];
}
