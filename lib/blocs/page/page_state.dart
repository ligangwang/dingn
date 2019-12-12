import 'package:dingn/models/account.dart';
import 'package:equatable/equatable.dart';

enum PageName { About, Number, NumberDetail, Account }

class PageState extends Equatable{
  const PageState({this.pageName, this.items, this.itemIndex, this.account});
  final PageName pageName;
  final List<Object> items;
  final int itemIndex;
  final Account account;
  @override
  List<Object> get props => [pageName, itemIndex];
}