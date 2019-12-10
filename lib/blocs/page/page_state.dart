import 'package:equatable/equatable.dart';

enum PageName { About, Number, NumberDetail, Account }

class PageState extends Equatable{
  const PageState(this.pageName, this.items, this.itemIndex);
  final PageName pageName;
  final List<Object> items;
  final int itemIndex;

  @override
  List<Object> get props => [pageName, itemIndex];
}