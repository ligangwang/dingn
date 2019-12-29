import 'package:dingn/interface.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

class ProviderModel extends ChangeNotifier {
  ProviderModel();
  ModelState _state = ModelState.Done;
  ModelState get state => _state;
  String _errorMessage;
  String get errorMessage=>_errorMessage;
  void setState(ModelState viewState) {
    _state = viewState;
    notifyListeners();
  }


}

enum ModelState { Progress, Done }

abstract class ListProviderModel<T> extends ProviderModel{
  ListProviderModel(this.collectionName, this.requestBatchSize);
  final DBService db = GetIt.instance.get<DBService>();
  final int requestBatchSize;
  final List<T> _items = [];
  bool _hasMoreData = true;
  bool get hasMoreData => _hasMoreData;
  int get wordCount => _items.length;
  List<T> get items => _items;
  T activeItem;
  int get activeIndex => _items.indexOf(activeItem);
  final String collectionName;

  void _add(List<T> items){
    _items.addAll(items);
    notifyListeners();
  } 

  Future<List<Map<String, dynamic>>> loadDataFromDb();

  Future<void> loadData() async{
    if (!hasMoreData)
      return;
    final dicts = await loadDataFromDb();
    final items = dicts.map((dict)=>dictToItem(dict)).toList();
    _hasMoreData = items.length == requestBatchSize;
    _add(items);
  }

  T dictToItem(Map<String, dynamic> data);

}
