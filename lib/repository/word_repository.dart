import 'package:dingn/models/word_model.dart';
import 'package:firebase/firebase.dart';
import 'package:firebase/firestore.dart';

class WordRepository {
  WordRepository(){
      _db = firestore();
  }

  Firestore _db;

  Future<List<Word>> retrieveData() async {
    try {
      final querySnapshot = await _db.collection('words').limit(20).get();
      return querySnapshot.docs.map((doc)=>_docToWord(doc)).toList();
    } catch (e) {
      throw '$e';
    }
  }

  Word _docToWord(DocumentSnapshot doc){
    if (!doc.exists)
      return null;
    final data = doc.data();
    return Word(doc.id, data['ipa_en'], data['number'], data['favorites'] ?? 0);
  }

  Future<Word> getWord(String word, String number) async {
    final docRef = _db.collection('words').doc(word);
    final docSnapshot = await docRef.get();
    return _docToWord(docSnapshot);
  }

  Future<bool> setWord(Word word) async {
    final docRef = _db.collection('words').doc(word.word);
    await docRef.set({'number': word.number, 'favorite_count': word.favoriteCount, 'ipa_en': word.ipaEn});
    return true;
  }
}
