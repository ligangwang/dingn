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

class ItemList<T>{
  ItemList(this.items);
  final List<T> items;
  int index;
  T get item => items[index]; 
  T operator[](int i) => items[i];
}

abstract class ListProviderModel<T> extends ProviderModel{
  ListProviderModel(this.collectionName, this.requestBatchSize){
    setActiveKey('1');
  }
  final DBService db = GetIt.instance.get<DBService>();
  final int requestBatchSize;
  final Map<String, ItemList<T>> _items = {};
  bool _hasMoreData = true;
  bool get hasMoreData => _hasMoreData;
  List<T> get items => _items[_activeKey].items;
  int get itemCount => items.length; 
  T get activeItem => _items[_activeKey].item;
  int get activeIndex => _items[_activeKey].index;
  set activeIndex(int index){
    _items[_activeKey].index = index;
  }
  final String collectionName;
  String _activeKey;
  String get activeKey => _activeKey;
  
  void setActiveKey(String activeKey){
    if (activeKey != _activeKey){
      _activeKey = activeKey;
      _items.putIfAbsent(_activeKey, ()=>ItemList([]));
      notifyListeners();
    }
  }

  void _add(List<T> itemList){
    items.addAll(itemList);
    notifyListeners();
  } 

  Future<List<Map<String, dynamic>>> loadDataFromDb();

  Future<void> loadData() async{
    if (!hasMoreData)
      return;
    final dicts = await loadDataFromDb();
    final dt = postLoad(dicts.map((dict)=>dictToItem(dict)).toList());
    _hasMoreData = dt.length == requestBatchSize;
  //  print('loaded items: ${dt.length}, $requestBatchSize');
    _add(dt);
  }

  List<T> postLoad(List<T> items){
    return items;
  }
  T dictToItem(Map<String, dynamic> data);

}
