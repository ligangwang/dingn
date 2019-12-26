import 'package:dingn/models/number_model.dart';
import 'package:dingn/repository/interface.dart';
import 'package:dingn/repository/user_repository.dart';

class NumberRepository {
  NumberRepository(UserRepository userRepository){
      _db = userRepository.db;
      _userRepository = userRepository;
  }

  DBService _db;
  UserRepository _userRepository;
  
  Future<void> setFavoriteWord(String number, String favoriteWord, String uid) async{
    try{
      await _db.setDoc('number_favorites', '$uid-$number', {'number': number, 'favoriteWord': favoriteWord, 'uid': uid});
    }catch(e){
      rethrow;
    }
  }

  Future<bool> setNumber(Number number) async {
    final doc = {'digits': number.number.length, 'number': number.number, 
    'updated_by': _userRepository.uid, 'updated_time': DateTime.now(), 
    'most_favorite_word': number.mostFavoriteWord, 'most_favorite_count': number.mostFavoriteCount,
    'words': number.words};
    await _db.setDoc('numbers', number.number, doc);
    return true;
  }

  Future<String> getMyFavoriteWord(String number) async{
    try{
      final key = '${_userRepository.uid}-$number';
      final doc = await _db.getDoc('number_favorites', key);
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
  
  Future<List<Number>> retrieveData(int digits, int batchSize) async {
    final data = await _db.query('numbers', 'digits', digits, batchSize);
    final numbers = data.map((d)=>_docToNumber(d)).toList();
    final myFavoriteWords = await getMyFavoriteWords(numbers);
    return List<Number>.from(
      numbers.map((item)=> item.setMyFavoriteWord(myFavoriteWords[numbers.indexOf(item)]))
    );
  }

  Number _docToNumber(Map<String, dynamic> data){
    final words = List.from(data['words']).map((i)=>i.toString()).toList();
    return Number(data['number'], words, data['most_favorite_word'], data['most_favorite_count'] ?? 0, null);
  }
}
