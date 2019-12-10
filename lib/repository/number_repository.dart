import 'package:dingn/models/number_model.dart';
import 'package:dingn/repository/user_repository.dart';
import 'package:firebase/firebase.dart';
import 'package:firebase/firestore.dart';

class NumberRepository {
  NumberRepository(UserRepository userRepository){
      _db = firestore();
      _lastNumDocs = {};
      _userRepository = userRepository;
  }

  Firestore _db;
  Map<int, DocumentSnapshot> _lastNumDocs;
  UserRepository _userRepository;
  
  Future<void> setFavoriteWord(String number, String favoriteWord, String uid) async{
    try{
      final key = '$uid-$number';
      final docRef = _db.collection('number_favorites').doc(key);
      await docRef.set({'number': number, 'favoriteWord': favoriteWord, 'uid': uid});
    }catch(e){
      rethrow;
    }
  }

  Future<bool> setNumber(Number number) async {
    final docRef = _db.collection('numbers').doc(number.number);
    await docRef.set({'digits': number.number.length, 'number': number.number, 
    'updated_by': _userRepository.uid, 'updated_time': DateTime.now(), 
    'most_favorite_word': number.mostFavoriteWord, 'most_favorite_count': number.mostFavoriteCount,
    'words': number.words});
    return true;
  }

  Future<String> getMyFavoriteWord(String number) async{
    try{
      final key = '${_userRepository.uid}-$number';
      final docRef = _db.collection('number_favorites').doc(key);
      final docSnapshot = await docRef.get();
      return docSnapshot == null? '' : docSnapshot.data()['favoriteWord'];
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
    try {
      QuerySnapshot querySnapshot;
      if (_lastNumDocs[digits] != null){
        querySnapshot = await _db.collection('numbers')
          .where('digits', '==', digits)
          .startAfter(snapshot:_lastNumDocs[digits])
          .limit(batchSize).get();
      }
      else{
        querySnapshot = await _db.collection('numbers')
          .where('digits', '==', digits)
        .limit(batchSize).get();
      }
      if (querySnapshot.docs.isNotEmpty){
        _lastNumDocs[digits] = querySnapshot.docs[querySnapshot.docs.length-1];
        final numbers = querySnapshot.docs.map((doc)=>_docToNumber(doc)).toList();
        final myFavoriteWords = await getMyFavoriteWords(numbers);
        return List<Number>.from(
          numbers.map((item)=> item.setMyFavoriteWord(myFavoriteWords[numbers.indexOf(item)]))
        );
      }else{
        return <Number>[];
      }
    } catch (e) {
      print('Error in retrieving number data: $e');
      rethrow;
    }
  }

  Number _docToNumber(DocumentSnapshot doc){
    final data = doc.data();
    final words = List.from(data['words']).map((i)=>i.toString()).toList();
    return Number(doc.id, words, data['most_favorite_word'], data['most_favorite_count'] ?? 0, null);
  }
}
