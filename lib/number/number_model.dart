import 'package:dingn/account/account_model.dart';
import 'package:dingn/account/provider_model.dart';
import 'package:dingn/number/number.dart';

class NumberModel extends ListProviderModel<Number> {
  NumberModel(this.accountModel, int requestBatchSize):super('numbers', requestBatchSize);

  final AccountModel accountModel;
  Future<void> setMyFavoriteWord(String number, String favoriteWord) async{
    try{
      items[activeIndex] = activeItem.setMyFavoriteWord(favoriteWord);
      notifyListeners(); 
      await saveFavoriteWord(number, favoriteWord);
    }catch(e){
      print('some thing wrong: $e');
      rethrow;
    }
  }

  Future<void> saveFavoriteWord(String number, String favoriteWord) async {
    final uid = accountModel.uid;
    await db.setDoc('number_favorites', '$uid-$number', {'number': number, 'favoriteWord': favoriteWord, 'uid': uid});
  }

  Future<bool> setNumber(Number number) async {
    final doc = {'digits': number.number.length, 'number': number.number, 
    'updated_by': accountModel.uid, 'updated_time': DateTime.now(), 
    'most_favorite_word': number.mostFavoriteWord, 'most_favorite_count': number.mostFavoriteCount,
    'words': number.words};
    await db.setDoc('numbers', number.number, doc);
    return true;
  }

  Future<String> getMyFavoriteWord(String number) async{
    try{
      final key = '${accountModel.uid}-$number';
      final doc = await db.getDoc('number_favorites', key);
      return doc==null? null: doc['favoriteWord'];
    }catch(e){
      print('getMyFavoriteWord error: $e');
      return null;
    }
  }
  
  Future<List<String>> getMyFavoriteWords(Iterable<Number> numbers) async{
    try{
      final favoriteWordFutures = numbers.map((number)=>getMyFavoriteWord(number.number));
      return await Future.wait(favoriteWordFutures);
    }catch(e){
      print('getMyFavoriteWords error: $e');
      return null;
    }
  }
  
  @override
  Future<List<Map<String, dynamic>>> loadDataFromDb() async {
    return await db.query(collectionName, 'digits', int.tryParse(activeKey), requestBatchSize);
  }

  @override
  Number dictToItem(Map<String, dynamic> data){
    final words = List.from(data['words']).map((i)=>i.toString()).toList();
    return Number(data['number'], words, data['most_favorite_word'], data['most_favorite_count'] ?? 0, null);
  }

  @override
  Future<List<Number>> postLoad(List<Number> items) async{
    final favorites = await getMyFavoriteWords(items);
    for (int i = 0; i<items.length; i++){
      items[i] = items[i].setMyFavoriteWord(favorites[i]);
    }
    return items;
  }
}
