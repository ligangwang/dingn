import 'package:dingn/account/account_model.dart';
import 'package:dingn/account/provider_model.dart';
import 'package:dingn/number/number.dart';

class NumberModel extends ListProviderModel<Number> {
  NumberModel(this.accountModel, int requestBatchSize):super('numbers', requestBatchSize);

  final AccountModel accountModel;
  int _activeDigits = 1;
  int get activeDigits => _activeDigits;
  
  void setDigits(int digits){
    _activeDigits = digits;
  }
  Future<void> setFavoriteWord(String number, String favoriteWord, String uid) async{
    try{
      await db.setDoc('number_favorites', '$uid-$number', {'number': number, 'favoriteWord': favoriteWord, 'uid': uid});
    }catch(e){
      rethrow;
    }
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
      return doc ?? doc['favoriteWord'];
    }catch(e){
      return null;
    }
  }
  
  Future<List<String>> getMyFavoriteWords(Iterable<Number> numbers) async{
    try{
      final favoriteWordFutures = numbers.map((number)=>getMyFavoriteWord(number.number));
      return await Future.wait(favoriteWordFutures);
    }catch(e){
      return null;
    }
  }
  
  @override
  Future<List<Map<String, dynamic>>> loadDataFromDb() async {
    return await db.query(collectionName, 'digits', activeDigits, requestBatchSize);
  }

  @override
  Number dictToItem(Map<String, dynamic> data){
    final words = List.from(data['words']).map((i)=>i.toString()).toList();
    return Number(data['number'], words, data['most_favorite_word'], data['most_favorite_count'] ?? 0, null);
  }
}
